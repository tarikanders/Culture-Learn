<div align="center">

# Culture-Learn

**AI-powered cultural content feed — discover ideas that match your taste**

[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Gemini](https://img.shields.io/badge/Gemini_API-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

---

## What it does

Culture-Learn is a **TikTok-style feed for knowledge** — but curated by an AI that learns your tastes. It surfaces articles, ideas, and cultural content ranked by your real interests, not engagement bait.

The ranking engine uses an **epsilon-greedy algorithm**: your liked categories and tags win most of the time, but unknown topics occasionally surface to prevent filter bubbles — the same design choice behind TikTok's For You page.

## Features

- **For You feed** — personalized ranking based on category & tag affinities with temporal decay
- **Explore mode** — break out of the filter bubble intentionally
- **Category & tag system** — content is tagged; interactions update your taste profile in real time
- **Dark UI** — smooth animations via `motion/react`, mobile-responsive sidebar + bottom nav
- **Profile persistence** — your taste profile is saved locally and evolves with every interaction

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Animations | Motion (Framer Motion) |
| AI | Gemini API |
| State | React hooks + localStorage |

## Run locally

```bash
npm install
# Set GEMINI_API_KEY in .env.local
npm run dev     # http://localhost:5173
```

## How the ranking works

```
score(item) = categoryAffinity
            + Σ(tagAffinity × 0.6)
            + recencyBonus
            + rand(0, EXPLORATION_WEIGHT)   ← prevents filter bubble
```

Affinities decay over time — content you liked last week counts less than today's interactions.
