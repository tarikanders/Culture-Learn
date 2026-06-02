import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

const feedCache = new Map<string, { data: any, timestamp: number }>();
const articleCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

app.use(express.json({ limit: '50mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy_key_to_prevent_crash" });

app.post("/api/feed", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Clé API Gemini manquante." });
    }

    const { feedType, userProfile, ignoredTitles = [], category } = req.body;
    
    // Create cache key without ignoredTitles dynamically to hit more cache
    const cacheKey = category ? `cat_${category}` : `feed_${feedType}`;
    const cached = feedCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
       console.log("Serving feed from cache:", cacheKey);
       // we simply shuffle and send, or just send
       return res.json(cached.data);
    }

    let systemInstruction = "Tu es un curateur d'élite. Ton but est de générer des cartes de sujets (titres et courts résumés d'une phrase) qui donneront envie à l'utilisateur de cliquer.";
    let prompt = "";
    
    let ignorePrompt = ignoredTitles.length > 0 ? `\n\nNE PARLE PAS de ces sujets car l'utilisateur les a déjà vus : ${ignoredTitles.slice(-10).join(', ')}` : "";

    if (feedType === "news_world") {
      prompt = "Fais une recherche web sur les actualités majeures de la semaine (géopolitique, tech, économie, sport, science). Propose 5 sujets/cartes accrocheurs basés sur ces actualités fraîches. Fournis toujours une 'source' fiable et une 'date' approximative." + ignorePrompt;
    } else if (feedType === "news_culture") {
      prompt = "Propose 5 sujets de fond intemporels (philosophie, psychologie, sciences, histoire récente). Pas de news chaude. Des concepts profonds et fascinants." + ignorePrompt;
    } else if (feedType === "stories_history") {
      prompt = "Propose 5 biographies ou événements historiques marquants sous forme d'idées de récits immersifs." + ignorePrompt;
    } else if (feedType === "stories_islam") {
      prompt = "Propose 5 récits tirés de l'Islam (prophètes, compagnons, faits civilisationnels ou spirituels) très inspirants." + ignorePrompt;
    } else {
      // foryou
      prompt = `Propose 5 sujets variés (mix actu, culture, histoire, islam) en t'adaptant aux préférences de l'utilisateur : ${JSON.stringify(userProfile || {})}. Fais des connexions pour élargir sa curiosité.` + ignorePrompt;
    }

    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING, description: "Titre de la carte (ex: Saladin, L'IA en 2025)." },
          summary: { type: Type.STRING, description: "Teaser d'une ou deux phrases maximum." },
          category: { type: Type.STRING, description: "La catégorie globale de cette carte." },
          date: { type: Type.STRING, description: "Date de l'événement ou de parution (ex: Aujourd'hui, Hier, 25 Mai 2026). Surtout pertinent pour l'actualité." },
          source: { type: Type.STRING, description: "Titre du média/source (ex: Reuters, Le Monde, Journal de la Science). Surtout pertinent pour l'actualité." }
        },
        required: ["id", "title", "summary", "category"]
      }
    };

    prompt += `
\n\nTu dois ABSOLUMENT retourner un tableau JSON valide contenant exactement ces champs pour chaque objet : ["id", "title", "summary", "category", "date", "source"]. \nExemple: [{"id": "1", "title": "...", "summary": "...", "category": "...", "date": "...", "source": "..."}]\nNe renvoie AUCUN texte avant ou après le JSON.`;

    let rawText = "";
    let data;
    try {
      let response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json", 
          responseSchema 
        }
      });
      rawText = response.text || "[]";
      rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const start = rawText.indexOf('[');
      const end = rawText.lastIndexOf(']');
      if (start !== -1 && end !== -1) {
        rawText = rawText.substring(start, end + 1);
      }
      data = JSON.parse(rawText);
    } catch(e: any) {
      console.log("Error in primary request or invalid JSON, retrying with gemini-1.5-flash without search:", e.message);
      await new Promise(r => setTimeout(r, 2000));
      try {
        let response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema
          }
        });
        rawText = response.text || "[]";
        rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
        const start = rawText.indexOf('[');
        const end = rawText.lastIndexOf(']');
        if (start !== -1 && end !== -1) {
          rawText = rawText.substring(start, end + 1);
        }
        data = JSON.parse(rawText);
      } catch (fallbackErr: any) {
         console.log("Fallback failed as well, using static data:", fallbackErr.message);
         const catName = category || "Général";
         data = [
          {
            id: 'FLBK-1',
            title: `Exploration : ${catName}`,
            summary: `Une courte pause ou une limite de requêtes a été atteinte. Ceci est un espace réservé pour le thème ${catName}.`,
            category: catName,
            date: "Aujourd'hui",
            source: "Flashback"
          },
          {
            id: 'FLBK-2',
            title: `Mystères de : ${catName}`,
            summary: `Découvrez bientôt nos articles détaillés concernant ${catName}. L'IA se repose un instant.`,
            category: catName,
            date: "Aujourd'hui",
            source: "Flashback"
          }
         ];
      }
    }

    // Save to cache only if we generated valid data
    if (data && Array.isArray(data) && data.length > 0 && !data[0].id?.includes('FLBK')) {
        feedCache.set(cacheKey, { data, timestamp: Date.now() });
    }

    res.json(data);
  } catch (error: any) {
    console.error("Feed endpoint error:", error.message);
    const retryCat = req.body?.category || "Général";
    res.json([
      {
        id: 'FLBK-OUTER-1',
        title: `Exploration : ${retryCat}`,
        summary: `Une courte pause ou une limite de requêtes a été atteinte. Espace réservé pour ${retryCat}.`,
        category: retryCat,
        date: "Aujourd'hui"
      },
      {
        id: 'FLBK-OUTER-2',
        title: `Mystères de : ${retryCat}`,
        summary: `L'IA prend une pause, vos articles sur ${retryCat} arrivent bientôt.`,
        category: retryCat,
        date: "Aujourd'hui"
      }
    ]);
  }
});

app.post("/api/generate-article", async (req, res) => {
  try {
    const { title, summary, category, id } = req.body;
    
    // Add cache based on id or title
    const articleKey = id || title;
    const cachedArticle = articleCache.get(articleKey);
    if (cachedArticle && Date.now() - cachedArticle.timestamp < CACHE_TTL) {
       console.log("Serving article from cache:", articleKey);
       return res.json(cachedArticle.data);
    }
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Clé API manquante." });
    }

    const prompt = `Génère un article de fond d'environ 600-800 mots sur le sujet suivant.
Titre: ${title}
Résumé: ${summary}
Catégorie: ${category}

STYLE D'ÉCRITURE:
Écris dans un style littéraire, humain, immersif et très captivant. Gère le rythme. Aucune formulation plate ou encyclopédique.

CRITÈRE ABSOLU DE FORMATAGE (MARKDOWN) ET IMAGES:
- Tu DOIS structurer ton article avec des titres Markdown comme suit : ## Un grand Sous-Titre puis ### Un plus petit si besoin.
- Tu DOIS absolument sauter DEUX LIGNES entre chaque paragraphe pour aérer la lecture.
- Utilise des blockquotes (>) pour mettre en valeur les idées fortes.
- Mets en **gras** (**) les concepts clés.
- IMAGES: Tu DOIS insérer 3 ou 4 images d'illustration réparties tout au long de l'article (après certains paragraphes) pour rendre la lecture agréable. Utilise la syntaxe Markdown standard avec des liens pollinations.ai. 
Format strict : ![description optionnelle](https://image.pollinations.ai/prompt/VOTRE_DESCRIPTION_EN_ANGLAIS?width=800&height=400&nologo=true)
Exemple : ![Rome antique](https://image.pollinations.ai/prompt/cinematic%20wide%20shot%20of%20ancient%20rome%20at%20sunset?width=800&height=400&nologo=true)
VOTRE_DESCRIPTION_EN_ANGLAIS doit être en anglais, très esthétique, et URL-encodée (utiliser %20 pour les espaces).

Le JSON final doit contenir :
- "content": le texte intégral AVEC LES BALISES MARKDOWN et les IMAGES intégrées, très aéré.
- "didYouKnow": une anecdote très surprenante et peu connue.
- "tags": 3 mots-clés qui décrivent le thème.
- "imagePrompt": une description visuelle (en anglais) très esthétique pour l'image de couverture principale (ex: "cinematic masterpiece wide shot").`;

    const promptWithJsonInstruction = prompt + `\n\nTu DOIS ABSOLUMENT répondre avec un code JSON valide (et rien d'autre) avec les clés exactes suivantes : "content", "didYouKnow", "tags" (liste de strings) et "imagePrompt". \nExemple: {"content": "...", "didYouKnow": "...", "tags": ["..."], "imagePrompt": "..."}\n\nATTENTION: Tu DOIS ÉCHAPPER tous les sauts de ligne avec \\n et tous les guillemets dans les valeurs texte. Ton JSON doit être 100% valide. Ne mets pas de vrais sauts de ligne dans les chaînes.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING },
        didYouKnow: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        imagePrompt: { type: Type.STRING }
      },
      required: ["content", "didYouKnow", "tags", "imagePrompt"]
    };

    let rawText = "";
    let data;
    try {
      let response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: promptWithJsonInstruction,
          config: {
            responseMimeType: "application/json",
            responseSchema 
          }
      });
      rawText = response.text || "{}";
      rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        rawText = rawText.substring(start, end + 1);
      }
      data = JSON.parse(rawText);
    } catch (err: any) {
      console.log("Error generating full article or invalid JSON, retrying with gemini-1.5-flash without search:", err.message);
      await new Promise(r => setTimeout(r, 2000));
      try {
        let response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: promptWithJsonInstruction,
            config: {
              responseMimeType: "application/json",
              responseSchema
            }
        });
        rawText = response.text || "{}";
        rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
        const start = rawText.indexOf('{');
        const end = rawText.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          rawText = rawText.substring(start, end + 1);
        }
        data = JSON.parse(rawText);
      } catch (fallbackErr: any) {
         console.log("Fallback full article failed, using static content:", fallbackErr.message);
         data = {
            content: "## Temporairement Indisponible\n\n> En raison d'un grand nombre de requêtes, ce contenu ne peut être généré dans l'immédiat.\n\nCe système utilise une intelligence artificielle qui est actuellement très sollicitée. Veuillez réessayer dans quelques minutes pour lire l'intégralité de cet article fascinant.\n\nLe monde est vaste et les histoires sont infinies, votre article vous attend un peu plus tard !",
            didYouKnow: "Le saviez-vous ? Les intelligences artificielles ont parfois besoin de souffler pour recharger leurs quotas !",
            tags: ["Patience", "Technologie", "Attente"],
            imagePrompt: "A serene waiting room in a library full of glowing ancient books, cinematic lighting."
         };
      }
    }
    
    if (data && data.content && !data.content.includes('Temporairement Indisponible')) {
       articleCache.set(articleKey, { data, timestamp: Date.now() });
    }

    res.json(data);
  } catch (err: any) {
    console.error("Error generating full article:", err);
    res.status(500).json({ error: "Impossible de créer le contenu complet." });
  }
});

app.post("/api/tts", async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Clé API Gemini manquante." });
    }

    if (!transcript || !Array.isArray(transcript)) {
      return res.status(400).json({ error: "Transcript manquant ou invalide." });
    }

    const ttsPrompt = transcript.map((t: any) => t.text).join('\n\n');

    const audioResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
        }
      }
    });

    const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
       throw new Error("Aucune donnée audio retournée par Gemini.");
    }

    res.json({ audioBase64: base64Audio });
  } catch (error: any) {
    console.error("TTS Error:", error);
    let errorMessage = error.message || "Erreur lors de la génération audio.";
    if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      errorMessage = "Quota dépassé (limite de 10 requêtes audio gratuites par jour). Veuillez configurer votre propre clé API avec facturation dans les Settings, ou réessayez demain.";
    } else if (errorMessage.includes("503") || errorMessage.includes("UNAVAILABLE")) {
      errorMessage = "Le service vocal est actuellement surchargé en raison d'une forte demande. Veuillez réessayer dans quelques instants.";
    }
    res.status(500).json({ error: errorMessage });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const { mode, input } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Clé API Gemini manquante. Veuillez la configurer dans l'onglet Settings." });
    }

    let systemInstruction = "";
    let prompt = "";

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Un titre accrocheur pour l'épisode." },
        summary: { type: Type.STRING, description: "Un résumé court du contenu (2-3 phrases)." },
        transcript: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "Le paragraphe ou la phrase explicative." }
            },
            required: ["text"]
          }
        }
      },
      required: ["title", "summary", "transcript"]
    };

    if (mode === "podcast") {
      systemInstruction = "Tu es un présentateur expert de podcast solo. Transforme le contenu brut (texte, pdf, info) en un récit captivant et fluide. Tu es la seule personne à parler. Fais un résumé audio percutant et engageant, pas trop long (max 2 à 3 minutes parler, environ 400 mots). Ton ton doit être premium, intelligent et clair.";
      prompt = `Crée un monologue explicatif concis et captivant basé sur le contenu suivant.\n\nContenu:\n${input}`;
    } else if (mode === "brief") {
      systemInstruction = "Tu es un journaliste et analyste solo de haut niveau. Ton rôle est de compiler un brief structuré et pertinent à partir des actualités, puis de le présenter seul à tes auditeurs comme un condensé très détaillé. Ne perds pas les informations clés.";
      prompt = `Crée un brief audio détaillé et continu autour de ces actualités.\n\nActualités (JSON):\n${input}`;
    } else if (mode === "learn") {
      systemInstruction = "Tu es un professeur magistral solo d'une université d'élite qui explique les concepts de manière détaillée et captivante. Crée un cours continu et exhaustif sur le concept demandé, sans rien omettre.";
      prompt = `Crée un cours audio pédagogique, riche et détaillé sur le concept suivant.\n\nSujet:\n${input}`;
    } else {
      return res.status(400).json({ error: "Mode non valide." });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
      }
    });

    const data = JSON.parse(response.text || "{}");

    if (data.transcript && data.transcript.length > 0) {
      for (const t of data.transcript) {
        t.speaker = 1;
        t.name = 'Narrator';
      }
    }

    res.json(data);
  } catch (error: any) {
    console.error("Erreur serveur:", error);
    let errorMessage = "Erreur lors de la génération. Veuillez réessayer.";
    if (error.message) {
      if (error.message.includes("429") || error.message.includes("quota") || error.message.includes("RESOURCE_EXHAUSTED")) {
        errorMessage = "Quota API dépassé. Veuillez configurer votre propre clé API dans les Settings.";
      } else if (error.message.includes("503") || error.message.includes("UNAVAILABLE")) {
        errorMessage = "Le service IA est actuellement surchargé en raison d'une forte demande. Veuillez réessayer dans quelques instants.";
      }
    }
    res.status(500).json({ error: errorMessage });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
