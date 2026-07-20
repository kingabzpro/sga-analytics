# SGA Analytics

Lightweight **SEO · AEO · GEO** website scoring app.

Paste a URL → get scores, check breakdowns, and improvement tips.

## What it measures

| Score | Focus |
|-------|--------|
| **SEO** | Classic on-page signals + [seord](https://www.npmjs.com/package/seord) content analysis |
| **AEO** | Answer Engine Optimization (FAQ schema, Q&A headings, snippet structure) |
| **GEO** | Generative Engine Optimization (JSON-LD, `llms.txt`, AI bot robots, E-E-A-T) |

Open-source stack: **cheerio**, **seord**, **robots-parser**. Optional AI tips via **Hugging Face Inference**.

## Quick start

```bash
npm install
cp .env.example .env.local
# optional: set HF_TOKEN (or FIREWORKS_API_KEY) for AI-written recommendations

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
| `HF_TOKEN` | No | HF or Fireworks API key for AI tips |
| `FIREWORKS_API_KEY` | No | Optional; used instead of `HF_TOKEN` if set |

**Model:** `deepseek-ai/DeepSeek-V4-Flash` via provider `fireworks-ai` (`@huggingface/inference`).

Without a token, the app still works using rule-based tips.

## Deploy (Vercel)

```bash
vercel env add HF_TOKEN production --value "<token>" --yes --force --sensitive
vercel --prod
```

## License

MIT
