import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const feedCache = new Map<string, { data: any; timestamp: number }>();
const articleCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000;

app.use(express.json({ limit: "10mb" }));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "dummy_key",
});

const rssParser = new Parser({
  timeout: 8000,
  headers: { "User-Agent": "CultureLearn/1.0 (compatible)" },
});

const NEWS_RSS_SOURCES = [
  { url: "https://www.lemonde.fr/rss/une.xml", name: "Le Monde", lang: "fr" },
  { url: "https://www.france24.com/fr/rss", name: "France 24", lang: "fr" },
  { url: "https://www.rfi.fr/fr/rss", name: "RFI", lang: "fr" },
  { url: "https://www.20minutes.fr/feeds/rss/actu", name: "20 Minutes", lang: "fr" },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", name: "BBC Monde", lang: "en" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", name: "Al Jazeera", lang: "en" },
];

async function fetchRealNews(): Promise<any[] | null> {
  const results = await Promise.allSettled(
    NEWS_RSS_SOURCES.map(async (source) => {
      const feed = await rssParser.parseURL(source.url);
      const items = feed.items.slice(0, 8).map((item, idx) => ({
        id: `rss-${source.name.replace(/\s/g, '')}-${Date.now()}-${idx}`,
        title: item.title || "Actualité",
        summary: (item.contentSnippet || item.summary || "").substring(0, 200).trim(),
        category: "Actualité mondiale",
        date: item.pubDate
          ? new Date(item.pubDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
          : "Aujourd'hui",
        source: source.name,
        lang: source.lang,
      }));
      if (items.length === 0) throw new Error("empty feed");
      console.log(`RSS OK: ${source.name} (${items.length})`);
      return { items, lang: source.lang };
    })
  );

  const frResult = results.find((r) => r.status === "fulfilled" && r.value.lang === "fr");
  if (frResult && frResult.status === "fulfilled") return frResult.value.items;

  const anyResult = results.find((r) => r.status === "fulfilled");
  if (anyResult && anyResult.status === "fulfilled") return anyResult.value.items;

  return null;
}

async function translateNewsItems(items: any[]): Promise<any[]> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: "Traduis titres et résumés en français fluide. JSON uniquement.",
      tools: [
        {
          name: "translated_news",
          description: "Articles traduits",
          input_schema: {
            type: "object" as const,
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    summary: { type: "string" },
                  },
                  required: ["title", "summary"],
                },
              },
            },
            required: ["items"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "translated_news" },
      messages: [
        {
          role: "user",
          content: `Traduis:\n${JSON.stringify(items.map((i) => ({ title: i.title, summary: i.summary })))}`,
        },
      ],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (toolUse?.type === "tool_use" && toolUse.input) {
      const translated = (toolUse.input as any).items as any[];
      return items.map((item, idx) => ({
        ...item,
        title: translated[idx]?.title || item.title,
        summary: translated[idx]?.summary || item.summary,
      }));
    }
  } catch (e) {
    console.log("Translation failed:", e);
  }
  return items;
}

async function callClaudeStructured<T>(
  system: string,
  userPrompt: string,
  toolName: string,
  toolDescription: string,
  schema: Anthropic.Tool["input_schema"],
  maxTokens: number = 512
): Promise<T> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools: [{ name: toolName, description: toolDescription, input_schema: schema }],
    tool_choice: { type: "tool", name: toolName },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Pas de réponse structurée");
  }
  return toolUse.input as T;
}

const FEED_SCHEMA: Anthropic.Tool["input_schema"] = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          category: { type: "string" },
          date: { type: "string" },
          source: { type: "string" },
        },
        required: ["id", "title", "summary", "category"],
      },
    },
  },
  required: ["items"],
};

// ── /api/feed ─────────────────────────────────────────────────────────────────

app.post("/api/feed", async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Clé ANTHROPIC_API_KEY manquante dans .env" });
    }

    const { feedType, preferences, ignoredTitles = [] } = req.body;

    const bypassCache = ignoredTitles.length > 0;

    if (feedType === "news_world") {
      const rssCacheKey = "rss_world_all";
      const cachedRss = feedCache.get(rssCacheKey);
      let allItems: any[] = [];

      if (cachedRss && Date.now() - cachedRss.timestamp < CACHE_TTL) {
        allItems = cachedRss.data;
      } else {
        const rssItems = await fetchRealNews();
        if (rssItems) {
          let finalItems = rssItems;
          if (rssItems[0]?.lang === "en") finalItems = await translateNewsItems(rssItems);
          allItems = finalItems;
          feedCache.set(rssCacheKey, { data: allItems, timestamp: Date.now() });
        }
      }

      if (allItems.length > 0) {
        const ignoredSet = new Set(ignoredTitles.map((t: string) => t.toLowerCase()));
        const available = allItems.filter((i: any) => !ignoredSet.has(i.title?.toLowerCase()));
        const toReturn = available.length >= 5 ? available.slice(0, 5) : allItems.slice(0, 5);
        return res.json(toReturn);
      }
    }

    const cacheKey = `feed_${feedType}`;
    const cached = feedCache.get(cacheKey);
    if (!bypassCache && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }

    const ignoreHint = ignoredTitles.length > 0
      ? ` Évite: ${ignoredTitles.slice(-8).join(", ")}.`
      : "";

    const prefHint = preferences?.liked?.length > 0
      ? ` Priorité aux sujets: ${preferences.liked.join(", ")}.${preferences.disliked?.length > 0 ? ` Éviter: ${preferences.disliked.join(", ")}.` : ""}`
      : "";

    const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const system = "Curateur de contenu. Génère 5 cartes captivantes. Titre avec 1 emoji pertinent.";

    let prompt = "";
    if (feedType === "news_world") {
      prompt = `${today}. 5 actualités mondiales importantes (géopolitique, tech, économie, science).${ignoreHint}${prefHint}`;
    } else if (feedType === "news_culture") {
      prompt = `5 sujets culture et savoirs : philosophie, psychologie, sciences, histoire des idées.${ignoreHint}${prefHint}`;
    } else if (feedType === "stories_history") {
      prompt = `5 récits de culture générale : biographies, découvertes, civilisations, révolutions culturelles.${ignoreHint}${prefHint}`;
    } else if (feedType === "stories_islam") {
      prompt = `5 récits islamiques : prophètes, compagnons, savants, civilisation islamique, sagesses spirituelles.${ignoreHint}${prefHint}`;
    } else {
      prompt = `5 cartes variées (actualité, culture, histoire, islam) adaptées aux préférences.${prefHint}${ignoreHint}`;
    }

    const result = await callClaudeStructured<{ items: any[] }>(
      system,
      prompt,
      "generate_feed_cards",
      "Générer les cartes du fil",
      FEED_SCHEMA,
      800
    );

    const data = result.items || [];
    if (data.length > 0) {
      feedCache.set(cacheKey, { data, timestamp: Date.now() });
    }

    res.json(data);
  } catch (error: any) {
    console.error("Feed error:", error.message);
    res.json([
      {
        id: "err-1",
        title: "Contenu temporairement indisponible",
        summary: "Vérifiez votre clé API Anthropic dans le fichier .env",
        category: "Info",
        date: "Aujourd'hui",
      },
    ]);
  }
});

// ── /api/generate-article ──────────────────────────────────────────────────────

app.post("/api/generate-article", async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Clé ANTHROPIC_API_KEY manquante." });
    }

    const { title, summary, category, id } = req.body;
    const articleKey = id || title;
    const cached = articleCache.get(articleKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }

    const result = await callClaudeStructured<any>(
      "Tu es un écrivain de talent. Articles immersifs, style littéraire, jamais encyclopédique. Toujours en français.",
      `Titre: ${title}\nRésumé: ${summary}\n\n280-320 mots. ## sous-titres, > blockquotes, **gras** pour concepts clés.`,
      "write_article",
      "Écrire un article",
      {
        type: "object",
        properties: {
          content: { type: "string" },
          didYouKnow: { type: "string", description: "Anecdote surprenante en 1 phrase" },
          tags: { type: "array", items: { type: "string" }, description: "3 mots-clés" },
        },
        required: ["content", "didYouKnow", "tags"],
      },
      1024
    );

    articleCache.set(articleKey, { data: result, timestamp: Date.now() });
    res.json(result);
  } catch (error: any) {
    console.error("Article error:", error.message);
    res.status(500).json({
      content: "## Temporairement Indisponible\n\n> Une erreur est survenue.\n\nVérifiez votre clé **ANTHROPIC_API_KEY** dans `.env`.",
      didYouKnow: "Vérifiez que votre clé ANTHROPIC_API_KEY est correctement configurée.",
      tags: ["Erreur"],
    });
  }
});

// ── Vite dev / production static ───────────────────────────────────────────────

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("⚠  ANTHROPIC_API_KEY is not set — add it to your .env file");
    }
  });
}

startServer();
