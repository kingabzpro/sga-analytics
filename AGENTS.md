<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SGA Analytics — Project Memory

> What this project is and how it fits together. Read this before editing so the
> work stays consistent. Update the Progress log when you finish a phase.

## What it is

**SGA Analytics** — a paste-a-URL website auditor. Enter a URL and get:

- **On-page scores** (0–100) for **SEO**, **AEO** (Answer Engine Optimization),
  **GEO** (Generative Engine Optimization), and **Speed**, rolled into a weighted
  **Overall**.
- **Domain Rating** — an off-page backlink-authority metric (0–100), shown as its
  own card, intentionally **separate from** the on-page Overall.
- Per-check breakdowns, AI-written recommendations, and a page-signals snapshot.

Open-source checks via **cheerio**, **seord**, **robots-parser**. AI tips via
**Mistral** (model `mistral-medium-latest`, through `@mistralai/mistralai`).
Domain Rating via **Open PageRank** when a key is set, else a heuristic on-page
estimate. Everything works with **zero env config** via graceful fallbacks.

## Stack

- **Next.js 16.2.10** (App Router, Turbopack), **React 19.2.4**, **Tailwind v4**.
- **React Compiler** is ON (`next.config.ts` `reactCompiler: true` + babel plugin)
  — write idiomatic React; avoid manual memo where the compiler can handle it,
  but verify with `npm run build`.
- Animation library: **`motion`** (Framer Motion), imported from `motion/react`.
- No charting library — the radar/ring visualizations are hand-rolled SVG.

## Architecture map

```
app/
  api/analyze/route.ts   POST { url } -> AnalyzeResult. runtime="nodejs", maxDuration=60.
  layout.tsx, page.tsx   root layout; home renders <AnalyzerApp/>.
  globals.css            teal/cyan design system + a few CSS keyframes.
components/
  AnalyzerApp.tsx        client component: URL form, fetch to /api/analyze, results layout.
  ScoreCards.tsx         animated SVG ring gauges (Overall+4) + Domain Rating hero card + radar.
  CheckList.tsx          per-category checks with animated progress bar + staggered rows.
  Recommendations.tsx    AI/rule tips bucketed by category.
  motion-helpers.tsx     shared CountUp, AnimatedRing, entrance/stagger variants.
  Logo.tsx
lib/
  analyze.ts             ORCHESTRATION. fetch -> extract -> score (seo/aeo/geo) ->
                         parallel (PSI, domain rating) -> score speed + weighted Overall
                         -> AI advice. OVERALL_WEIGHTS constants live here.
  score-utils.ts         the scoring ENGINE: scoreFromChecks (partial credit), buildCategory,
                         clamp, clamp01, ramp, rampDown.
  score-seo.ts           12 checks, blends in seord content score.
  score-aeo.ts           8 checks.
  score-geo.ts           9 checks.
  score-speed.ts         7 CWV-led checks (real LCP/INP/CLS/FCP/TBT/TTFB via PSI) OR 8
                         on-page heuristic checks (zero-config fallback). scoreSpeed(signals, psi).
  psi.ts                 PageSpeed Insights v5 call, env-gated, heuristic fallback. Never throws.
  ai-recommendations.ts  Mistral call, env-gated, timeout race, rule fallback.
  domain-rating.ts       Open PageRank call, env-gated, heuristic fallback. Never throws.
  fetch-page.ts          outbound fetch (HTML/robots/sitemap/llms) + SSRF guard.
  extract.ts             cheerio signal extraction -> PageSignals.
  types.ts               CheckResult, CategoryScore, PageSignals, DomainRating, PsiMetrics, AnalyzeResult.
```

## Key conventions (follow these)

- **Scoring engine = weighted partial credit.** Each `CheckResult` carries a
  `weight` and an optional `partialScore` (0–1). Credit = `weight * (partialScore
  ?? (passed ? 1 : 0))`. Prefer a gradient (`partialScore` via `ramp`/`rampDown`)
  for signals that vary on a spectrum (length, time, count); keep binary
  (`passed` only) for present/absent signals (HTTPS, viewport, schema). Always
  still set `passed` truthy at the check's pass threshold so the ✓ shows.
- **Overall is a weighted blend** of the four category scores
  (`OVERALL_WEIGHTS` in `analyze.ts`, default SEO 35 / AEO 25 / GEO 20 / Speed
  20). **Domain Rating is excluded** — it's off-page.
- **External calls are env-gated with graceful fallback + a `source`
  discriminator** (`aiSource: "mistral"|"rules"`,
  `domainRating.source: "openpagerank"|"heuristic"`,
  `psiMetrics.source: "psi" | null`). Never let them throw up to the route
  handler; degrade to a rule/heuristic result. This is the template for any new
  integration. Note: speed scoring depends on PSI, so in `analyze.ts` PSI +
  domain-rating are fetched in parallel *first*, then speed/Overall are scored,
  then AI advice runs last (it needs the final scores).
- **Animation** goes in `motion/react` (not new CSS keyframes). Scroll-triggered
  via `whileInView`/`useInView`; one-shot. Reusable primitives in
  `components/motion-helpers.tsx`.
- **Next.js 16 caveat:** the banner above is real. Before touching route
  handlers, metadata, or async `params`/`searchParams`, check
  `node_modules/next/dist/docs/01-app/`.

## Environment variables (ALL optional — app works without any)

| Variable | Purpose |
|----------|---------|
| `MISTRAL_API_KEY` | Mistral key for AI tips via `mistral-medium-latest` (rule-based fallback otherwise) |
| `OPEN_PAGE_RANK_API_KEY` | Open PageRank key (`opr_live_...`) for an authoritative Domain Rating (heuristic estimate otherwise) |
| `PAGESPEED_API_KEY` | Google PageSpeed Insights v5 key for real Core Web Vitals — LCP/INP/CLS/FCP/TBT/TTFB — feeding the Speed score (on-page heuristics otherwise) |
| `HF_TOKEN` / `FIREWORKS_API_KEY` | Legacy — no longer used since the switch to Mistral; kept for reference |

Never commit real secrets. Only `.env.example` is tracked.

## Progress log

- **2026-07-29** — Scoring + Domain Rating + interactive stats.
  - Scoring engine upgraded from pure binary to **weighted partial credit**
    (`CheckResult.partialScore`, `ramp`/`rampDown` in `score-utils.ts`); converted
    gradient-friendly checks in all four scorers. Overall moved from flat mean to
    a weighted blend (`OVERALL_WEIGHTS`), and the SEO seord blend was folded into
    the seord check's `partialScore` for consistency.
  - Added **Domain Rating**: `lib/domain-rating.ts` (Open PageRank primary,
    heuristic fallback), new `DomainRating` type + field on `AnalyzeResult`,
    wired into `analyze.ts` running **in parallel** with AI advice. Standalone
    metric — not part of Overall.
  - Added **`motion` (Framer Motion)**: animated SVG rings with count-up numbers,
    a Domain Rating hero card, an on-page radar chart, animated checklist
    progress bars + staggered rows. New `components/motion-helpers.tsx`.
  - Verified: `tsc`, `eslint`, `next build` all pass; live `/api/analyze` of
    `example.com` returns partial-credit scores + a heuristic Domain Rating.
- **2026-07-29 (phase 2)** — AI model + copy fixes.
  - **Switched AI tips to Mistral** (`@mistralai/mistralai`, `mistral-medium-latest`,
    `MISTRAL_API_KEY`). Reason: the previously-tried `poolside/Laguna-S-2.1:featherless-ai`
    cold-started past every timeout and threw provider HTTP errors on real audit
    prompts — every analysis hung ~45s then fell back to rules. Mistral answers a
    full audit prompt in ~5s with clean `VERDICT:` / `[TAG]` output. DeepSeek-V4-Flash
    on Fireworks was the prior working model. `@huggingface/inference` import removed.
  - Hardened AI tip parsing (`normalizeTip`) and the component `splitTip` so
    malformed output (`SEO: issue -> action: fix`) renders as clean tagged tips
    instead of raw text; summary filter now drops echoed prompt placeholders.
  - Dropped "Speed" from the hero title/subtitle and the empty-state card grid
    (now 3 cards: SEO/AEO/GEO) to match the nav and trim copy.
  - Verified: live `/api/analyze` of `abid.work` now returns `aiSource: huggingface`
    (real Mistral tips) in ~5.6s (was 49.7s → rules). `tsc`/`eslint`/`next build` pass.
- **2026-07-29 (phase 3)** — Real Core Web Vitals via PageSpeed Insights.
  - Replaced the weakest scoring category — **Speed**, previously all static-HTML
    heuristics — with **real Core Web Vitals** from the **Google PageSpeed
    Insights API v5** (`lib/psi.ts`): one `runPagespeed?strategy=mobile&category=performance`
    call bundles CrUX field data (`loadingExperience`, with origin-level fallback)
    and a Lighthouse lab run (`lighthouseResult`). New `PsiMetrics` type + `psiMetrics`
    field on `AnalyzeResult`. Env-gated on `PAGESPEED_API_KEY` with a `source: "psi"`
    discriminator; returns `null` (→ heuristic Speed) on no-key/failure/timeout,
    **mirroring the `domain-rating.ts` template exactly** (never throws).
  - `lib/score-speed.ts` reworked: `scoreSpeed(signals, psi?)` now branches into
    either a **7-check CWV-led set** (LCP 26 / INP 20 / CLS 18 / FCP 12 / TBT 10 /
    TTFB 8 / perf 6 — field p75 preferred, lab fills gaps, source labeled in each
    `detail`) when PSI is present, or the **unchanged 8-check heuristic set** as
    the zero-config fallback. `scoreFromChecks` normalizes by total weight, so
    both tables produce valid 0–100 scores without hand-balancing.
  - Re-ordered `lib/analyze.ts`: PSI + domain-rating fetch in parallel **first**,
    then speed + weighted Overall scored, then AI advice last (it needs the final
    scores). PSI runs add ~5–15s to the critical path; worst case stays well under
    `maxDuration = 60`.
  - UI: Speed tab gets a "PageSpeed Insights" / "Estimated (no PSI key)" badge
    (`ScoreCards.tsx`), the footer credits PSI when live, and the page-signals
    snapshot gains a Core Web Vitals row (`AnalyzerApp.tsx`).
  - Verified: `tsc`/`eslint`/`next build` pass; PSI response parsing validated
    against a fixture payload (field+lab, field-only, lab-only, CLS ×100
    normalization). No-key path returns `psiMetrics: null` and identical Speed
    scores to pre-phase-3.
