# SGA Analytics

Lightweight **SEO · AEO · GEO** website scoring app.

Paste a URL → get scores, check breakdowns, and improvement tips.

## What it measures

| Score | Focus |
|-------|--------|
| **SEO** | Classic on-page signals + [seord](https://www.npmjs.com/package/seord) content analysis |
| **AEO** | Answer Engine Optimization (FAQ schema, Q&A headings, snippet structure) |
| **GEO** | Generative Engine Optimization (JSON-LD, `llms.txt`, AI bot robots, E-E-A-T) |
| **Speed** | Response time, page weight, render-blocking resources, image load |
| **Domain Rating** | Actual backlink-based DR via [Ahrefs](https://docs.ahrefs.com/en/api/reference/public/get-domain-rating-free), then Open PageRank, else a labeled estimate |

The on-page **Overall** score is a weighted blend of SEO / AEO / GEO / Speed (Domain Rating is shown separately as an off-page metric). Scores use continuous partial credit, so a "nearly good" signal earns partial credit instead of zero.

Open-source stack: **cheerio**, **seord**, **robots-parser**. Optional AI tips via **Mistral** (`mistral-medium-latest`). Interactive stats via **motion**.

## Quick start

```bash
npm install
cp .env.example .env.local
# optional: set MISTRAL_API_KEY for AI-written recommendations

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

`POST /api/analyze`

```json
{ "url": "https://example.com" }
```

Returns overall + SEO/AEO/GEO scores, checks, and recommendations.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `MISTRAL_API_KEY` | No | Mistral API key for AI tips (`mistral-medium-latest`) |
| `AHREFS_API_KEY` | No* | Free Ahrefs API key; required by Ahrefs starting August 10, 2026 |
| `OPEN_PAGE_RANK_API_KEY` | No | Open PageRank key (`opr_live_...`) for an authoritative Domain Rating |
| `PAGESPEED_API_KEY` | No | Google key for low-latency CrUX field data, with PSI fallback |
| `SPEED_DATA_MODE` | No | `crux` (default, PSI fallback) or `psi` |

**Model:** `mistral-medium-latest` via `@mistralai/mistralai`.

Without any keys, the app still works — AI tips fall back to rules. Ahrefs DR
currently permits unauthenticated access; if authority providers fail, the UI
clearly labels the fallback as an estimate.

## Deploy (Vercel)

```bash
vercel env add MISTRAL_API_KEY production --value "<token>" --yes --force --sensitive
vercel --prod
```

## License

MIT
