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
  api/analyze/route.ts   POST { url } -> AnalyzeResult (cached 10 min, X-Cache header). runtime="nodejs", maxDuration=30.
  api/analyze/stream/    NDJSON progress stream variant of the same (cached; tags the result event with `cached`).
  layout.tsx, page.tsx   root layout; home renders <AnalyzerApp/>.
  globals.css            teal/cyan design system + a few CSS keyframes.
components/
  AnalyzerApp.tsx        client component: URL form, fetch to /api/analyze, results layout.
  CitabilityCard.tsx     phase-4 flagship: "would ChatGPT cite this?" verdict card (Mistral + rule fallback).
  ScoreCards.tsx         animated SVG ring gauges (Overall + 5 categories) + Domain Rating hero + tabbed checks.
  Recommendations.tsx    AI/rule tips bucketed by category (SEO/AEO/GEO/SPD/TECH/DR).
  motion-helpers.tsx     shared CountUp, AnimatedRing, entrance/stagger variants.
  Logo.tsx
lib/
  analyze.ts             ORCHESTRATION. fetch -> extract -> score (seo/aeo/geo) ->
                         parallel (PSI, domain rating, broken-links HEAD probe) ->
                         score speed + technical + weighted Overall -> AI advice + citability probe
                         (parallel). OVERALL_WEIGHTS (5-way) constants live here.
  score-utils.ts         the scoring ENGINE: scoreFromChecks (partial credit), buildCategory,
                         clamp, clamp01, ramp, rampDown.
  score-seo.ts           12 checks, blends in seord content score.
  score-aeo.ts           9 checks (incl. phase-4 definitional opening).
  score-geo.ts           11 checks (incl. phase-4 statistics + quotations — Princeton GEO signals).
  score-speed.ts         7 CWV-led checks (real LCP/INP/CLS/FCP/TBT/TTFB via PSI) OR 8
                         on-page heuristic checks (zero-config fallback). scoreSpeed(signals, psi).
  score-technical.ts     5 checks (phase 4): security headers, HTTPS enforced, redirect chain,
                         image dimensions, broken outbound links. scoreTechnical({signals, brokenLinks}).
  check-links.ts         bounded parallel HEAD probe of outbound links (cap 15, SSRF-guarded). Never throws.
  cache.ts               phase 6: 10-min TTL analysis cache + in-flight request coalescing. analyzeUrlCached()
                         wraps analyzeUrl (kept pure). In-memory only (warm-instance scope on serverless).
  psi.ts                 PageSpeed Insights v5 call, env-gated, heuristic fallback. Never throws.
  ai-recommendations.ts  Mistral tips + the LLM citability probe (generateCitabilityProbe). Env-gated, never throws.
  domain-rating.ts       Open PageRank call, env-gated, heuristic fallback. Never throws.
  fetch-page.ts          outbound fetch (HTML/robots/sitemap/llms) + SSRF guard. Exposes response
                         headers + redirect flag for the Technical category.
  extract.ts             cheerio signal extraction -> PageSignals (incl. phase-4 statistics/quotation/
                         readability/definition + image-dimension counts).
  types.ts               CheckResult, CategoryScore, PageSignals, DomainRating, PsiMetrics,
                         BrokenLink, CitabilityProbe, AnalyzeResult.
```

## Key conventions (follow these)

- **Scoring engine = weighted partial credit.** Each `CheckResult` carries a
  `weight` and an optional `partialScore` (0–1). Credit = `weight * (partialScore
  ?? (passed ? 1 : 0))`. Prefer a gradient (`partialScore` via `ramp`/`rampDown`)
  for signals that vary on a spectrum (length, time, count); keep binary
  (`passed` only) for present/absent signals (HTTPS, viewport, schema). Always
  still set `passed` truthy at the check's pass threshold so the ✓ shows.
- **Overall is a weighted blend** of the **five** category scores
  (`OVERALL_WEIGHTS` in `analyze.ts`, default SEO 30 / AEO 22 / GEO 18 / Speed
  15 / Technical 15). **Domain Rating is excluded** — it's off-page.
- **External calls are env-gated with graceful fallback + a `source`
  discriminator** (`aiSource: "mistral"|"rules"`,
  `domainRating.source: "openpagerank"|"heuristic"`,
  `psiMetrics.source: "psi" | null`,
  `citability.source: "mistral"|"rules"`). Never let them throw up to the route
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

## Product roadmap

### Next focus — in-house Domain Rating and Speed

The next major product goal is to own both metrics instead of depending on
third-party scoring APIs:

- **Domain Rating:** build an SGA-owned authority index from independently
  collected link and domain signals. Never present on-page heuristics as
  backlink authority. Document the formula, calibration, provenance, freshness,
  and spam handling.
- **Speed:** build an SGA-owned browser measurement runner for repeatable lab
  performance and Core Web Vitals-compatible metrics. Keep the audited-page
  scrape separate from the performance run so scraping behavior cannot distort
  Speed scoring.
- **Transition:** Open PageRank and PageSpeed Insights remain authoritative
  external sources until the replacements are validated. Preserve env-gated,
  never-throw fallbacks and source/status discriminators throughout migration.
- **Acceptance:** benchmark representative sites against current providers,
  version scoring changes, and switch defaults only after the in-house metrics
  meet production targets for repeatability, latency, and calibration.

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
- **2026-07-29 (phase 4)** — GEO/AEO depth + Technical category + LLM citability probe.
  Three sequenced tracks, web-grounded in the **Princeton GEO paper** (arXiv
  2311.05232), Search Engine Land's 2026 GEO guide, and Google's AI-optimization
  guide; feature-set compared against Semrush/Ahrefs/Screaming Frog.
  - **Track A — Princeton-aligned signal depth.** Added pure text-analysis
    helpers in `lib/extract.ts` (statistics/figures, quotations, Flesch
    readability, definitional openings) over the existing `bodyText`, surfaced
    as new `PageSignals` fields. New GEO checks `statistics` + `quotations`
    (3 of the 4 highest-evidence Princeton citability tactics) and AEO check
    `definition` (snippet-favored "X is a…" leads); all three scorer tables
    reweighted to sum 100. Relabeled the GEO tab "LLM citability readiness" to
    match Google's actual guidance (schema/llms.txt help non-Google LLMs, not
    Google ranking).
  - **Track B — 5th scored category: Technical.** `lib/fetch-page.ts` now
    exposes response headers + a redirect flag; `lib/extract.ts` counts images
    with/without dimensions. New `lib/score-technical.ts` (5 checks: security
    headers, HTTPS enforced, redirect chain, image dimensions, broken outbound
    links) + `lib/check-links.ts` (bounded parallel HEAD probe, capped at 15
    outbound links, SSRF-guarded, never throws). `OVERALL_WEIGHTS` became a
    **5-way blend** (SEO 30 / AEO 22 / GEO 18 / Speed 15 / Tech 15). Pipeline
    runs the link probe in parallel with PSI + DR; Technical + Speed + Overall
    score after, then AI advice last.
  - **Track C — LLM citability probe (flagship).** `generateCitabilityProbe`
    in `lib/ai-recommendations.ts`: auto-derives a target query from the page
    (H1 → title → lead paragraph) and asks Mistral "would you cite this page?"
    returning `{verdict, score 0–100, gaps[], reason}`. Reuses the existing
    Mistral client + timeout + try/catch→fallback; degrades to a rule-based
    probe derived from GEO/AEO scores when no key or a failure. New
    `CitabilityProbe` type + `citability` field on `AnalyzeResult`. New
    `components/CitabilityCard.tsx` (verdict pill + score ring + gaps), placed
    above the tabbed score cards.
  - Verified: `tsc`/`eslint`/`next build` pass; 16-assertion fixture test covers
    scorer weights (all sum 100), partial-credit math, broken-link ratio,
    `deriveQuery` fallback/trimming. Live local `/api/analyze` of a Wikipedia
    article returns 5 categories (Overall 74), a `would-cite` Mistral probe
    (score 95), and a fully-populated Technical category. Phase-4 work is **not
    yet deployed** to Vercel (still the phase-3 build until pushed).
- **2026-07-30 (phase 5)** — Faster evidence pipeline + visible progress.
  - Made **CrUX-first** field data the default: low-latency 28-day real-user
    LCP/INP/CLS/FCP/TTFB, with PSI/Lighthouse fallback when CrUX has no record.
    `SPEED_DATA_MODE=psi` forces the lab path for comparisons.
  - Bounded page/support-file, authority, and broken-link probes; outbound link
    checks now run in one capped parallel batch. Mistral keeps an 8-second rule
    fallback so provider failures never block a report indefinitely.
  - Added a simple elapsed-time activity log in `AnalyzerApp` so longer
    provider/Lighthouse runs clearly show the audit stages.
  - Follow-up: replaced the time-based activity simulation with an NDJSON
    progress stream (`/api/analyze/stream`). Events now come from actual backend
    completions and identify provider results versus fallbacks. PSI, authority,
    links, recommendations, and citability now run concurrently after extraction
    instead of serializing PSI before Mistral.
  - Research decision: do not label a single-page heuristic as in-house Domain
    Rating. A credible replacement needs a continuously crawled backlink graph;
    evaluate DataForSEO Rank as the next provider-backed integration.
  - Authority follow-up: integrated the official free **Ahrefs Domain Rating**
    endpoint as the primary source (actual 0–100 logarithmic DR, ~0.4s observed).
    Optional `AHREFS_API_KEY` supports the announced 2026-08-10 authentication
    requirement. Open PageRank is secondary; the on-page fallback remains
    explicitly labeled as an estimate rather than backlink authority.
  - Protected-site follow-up: direct 401/403/429 responses now attempt a
    Jina Reader content fallback. The fallback is source-discriminated
    (`fetchSource: "reader"`), visibly warns that origin-header checks are
    limited, and never masquerades as raw origin HTML. Live DataCamp audit:
    reader extraction succeeded (1,506 words), Ahrefs DR 84, no route error.
  - Link-check accuracy follow-up: only definitive `404`/`410` responses count
    as broken. `401`/`403` bot blocks, `429` rate limits, `5xx`, and network
    uncertainty are reported as unverified and do not reduce the score.
  - Verified: `eslint`, `tsc`, and `next build` pass. Production-mode local
    audits completed in ~6 seconds on the fast path and ~10.5 seconds on a CrUX
    miss with the intentionally short initial fallback budget; PSI now has a
    separate 18-second accuracy budget while the UI keeps the user informed.
- **2026-07-31 (phase 6)** — 10-minute analysis cache + in-flight coalescing.
  - New `lib/cache.ts`: a TTL'd (`ANALYZE_CACHE_TTL_MS = 10 min`) **in-memory**
    result cache plus **in-flight request coalescing**. `analyzeUrlCached()`
    wraps `analyzeUrl` (kept a pure analysis function). On a completed hit the
    full provider pipeline (Ahrefs → CrUX/PSI → Mistral → broken-link probe) is
    skipped and the cached result is served instantly; on an in-flight hit the
    second caller joins the running promise instead of starting a second audit.
    `cacheKey()` reuses `normalizeUrl` (same 400/502 errors as today) and
    canonicalizes host+path+search (scheme → `https://`, trailing slash stripped).
    Memory is bounded (`MAX_ENTRIES = 100`, oldest-first eviction); lazy
    eviction on read; inflight slot is always cleared on settle, never poisoned.
  - `result.analyzedAt` is **not** refreshed on a cache hit, so the report stays
    honest about when the page was actually fetched.
  - **Transparency follows the source-discriminator pattern:** the stream tags
    its terminal `result` event with `cached`, the non-stream route returns an
    `X-Cache: HIT|MISS` header, and `AnalyzerApp` shows a teal "Cached · served
    from a recent analysis" pill with the original analysis timestamp. A
    `stage: "cache"` progress event (`"Served from cache · analyzed N min ago"`
    / `"…already running — joining it"`) feeds the existing activity log; the
    `AnalyzeProgress` stage union gained `"cache"`.
  - **Serverless caveat (documented):** this is an in-memory, module-level cache,
    so it persists only within a **warm** instance — cold starts and concurrent
    instances do not share it. It still de-duplicates rapid re-analyses and saves
    provider spend within a warm instance. A durable store (Vercel KV / Upstash)
    layered as an env-gated second tier is the documented future upgrade; it was
    intentionally not added to preserve the project's zero-config ethos.
  - Verified: `tsc`, `eslint`, and `next build` all pass; both route handlers
    compile as dynamic (`ƒ`) functions.
