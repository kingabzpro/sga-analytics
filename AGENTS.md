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
                         Reserves an env-gated audit allowance before provider work.
  api/analyze/stream/    NDJSON progress stream variant of the same (cached; tags the result event with `cached`).
  api/quota/             GET the current anonymous/member free-audit allowance.
  sign-in/page.tsx       Clerk <SignIn/> page (redirects away when auth is off).
  layout.tsx, page.tsx   root layout (conditional <ClerkProvider>); home renders <AnalyzerApp authEnabled>.
  globals.css            teal/cyan design system + a few CSS keyframes.
proxy.ts                 Next 16 renamed middleware->proxy. clerkMiddleware() only when BOTH
                         Clerk keys are set; otherwise a pass-through (zero-config, no keyless dev mode).
components/
  AnalyzerApp.tsx        client component: URL form, fetch to /api/analyze/stream, results layout.
                         Restores the pre-auth landing composition; Clerk opens as a unified
                         sign-in-or-up modal (`withSignUp`) from the nav or after audit one.
  CitabilityCard.tsx     phase-4 flagship: "would ChatGPT cite this?" verdict card (Mistral + rule fallback).
  ScoreCards.tsx         animated SVG ring gauges (Overall + 5 categories) + Domain Rating hero + tabbed checks.
  Recommendations.tsx    AI/rule tips bucketed by category (SEO/AEO/GEO/SPD/TECH/DR).
  motion-helpers.tsx     shared CountUp, AnimatedRing, entrance/stagger variants.
  Logo.tsx
emails/
  clerk-magic-link.*     Source-of-truth Clerk editor markup + email-safe HTML for
                         the shared sign-in/sign-up magic-link message.
  clerk-new-device.*     Matching branded security-notification templates.
scripts/
  sync-clerk-email-template.mjs  Pushes all branded templates to the Clerk instance
                         selected by CLERK_SECRET_KEY (`npm run email:sync`).
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
  auth.ts                Clerk render-side env-gating via isClerkConfigured() (publishable
                         key only, since NEXT_PUBLIC vars are build-time inlined).
  audit-quota.ts         One signed-cookie anonymous audit + five Clerk-metadata member
                         audits; fail-closed when Clerk is partially configured.
  clerk-theme.ts         Clerk appearance prop matching the teal design system.
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
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk email magic-link login gate. With BOTH set, visitors must sign in before auditing (UI gate + server-side 401 on `/api/analyze*`); without them the app is fully open. `NEXT_PUBLIC_*` is inlined at build time — set before deploy. Optional `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` avoids a Clerk Next 16 proxy redirect bug. The magic-link factor itself is enabled in the Clerk Dashboard (Email → "Email verification link"). |
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
- **2026-08-22 (auth gate)** — Clerk email magic-link login (phase 7 Track C,
  pulled forward). Users must enter an email and click a magic link before they
  can audit; the gate is a hard requirement whenever Clerk keys are set.
  - `@clerk/nextjs` 7.8.0 (peers allow Next ^16.1 / React ~19.2.3). Next 16
    renamed `middleware.ts` → **`proxy.ts`**; Clerk's `clerkMiddleware()` is
    default-exported from there with Clerk's official matcher (the `/__clerk/*`
    entries are required for magic-link verification).
  - **Env-gating split on purpose:** the render side (`isClerkConfigured()` in
    `lib/auth.ts`, used by layout's conditional `<ClerkProvider>`, home, and
    `/sign-in`) checks ONLY `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` because
    NEXT_PUBLIC vars are inlined at build time — a both-keys check would bake
    `false` into statically prerendered pages when keys are runtime-only. The
    enforcement side (`requireSignIn()`) checks both keys per request at
    runtime, returns 401 when signed out, and 503 when only the publishable
    key is set (misconfiguration surfaced, never silent). Fail-closed on Clerk
    errors — this gate protects paid-provider spend.
  - `components/EmailGate.tsx`: `<Show when="signed-out">` shows the themed
    prebuilt `<SignIn fallbackRedirectUrl="/">` (enter email → "check your
    inbox" → click link → signed in; 10-min link TTL, 30s resend cooldown);
    `<Show when="signed-in">` renders the auditor. Clerk Core 3 (v7) REMOVED
    `<SignedIn>`/`<SignedOut>` — they throw at runtime; `<Show>` is the
    replacement (returns null while auth loads, so no gate flash).
    Magic link itself is a **Clerk Dashboard toggle** (Email → "Email
    verification link"), not a component prop. Nav's "Free URL audit" pill
    swaps for `<UserButton>` (no `afterSignOutUrl` in v7) when auth is on.
    `lib/clerk-theme.ts` themes Clerk to the teal design tokens.
  - `/api/analyze` and `/api/analyze/stream` both call `requireSignIn()` first
    (outside the try/catch in the non-stream route so 401 isn't remapped to
    502); the existing client error banner already renders the `{ error }` 401
    shape. New `/sign-in` page serves as `NEXT_PUBLIC_CLERK_SIGN_IN_URL` target
    (avoids clerk/javascript#8302, a Next 16 proxy redirect bug) and redirects
    away when auth is off.
  - Clerk user data stays in Clerk (we read only `userId` server-side — no
    Backend API call on the audit path; no email storage on our side).
  - Zero-config verified: with no Clerk vars the proxy is a pass-through, no
    `ClerkProvider` renders, and the app behaves identically to phase 6.
    Remaining manual step: create the Clerk app, enable the Email link factor,
    set allowed origins, and set the two keys in Vercel (before build).
  - **Setup completed 2026-08-22 (Clerk CLI).** `clerk` CLI 3.1.0 installed,
    logged in, and linked to the "sga-analytics" Clerk app (development
    instance). `clerk init` SKIPPED our custom `proxy.ts`/`layout.tsx`
    (detected as configured) and scaffolded path-routed catch-all pages
    `app/sign-in/[[...sign-in]]/page.tsx` + `app/sign-up/[[...sign-up]]/page.tsx`
    (merged with our auth-off redirect + teal theme; the earlier simple
    `app/sign-in/page.tsx` was removed to avoid a route conflict). Real dev
    keys + sign-in/up redirect vars written to `.env` by init.
  - **Instance config patched via `clerk config patch`:** password factor
    disabled (`auth_password.enabled/required: false`) so email_link is the
    ONLY factor, and `auth_attack_protection.email_link_require_same_client`
    set to false so links open across browsers/devices. Note: Clerk's SignIn
    rejects unknown emails ("Couldn't find your account") even with public
    sign-ups, so the home gate mounts `<SignUp />` (identical one-field card
    with password disabled); returning users follow its "sign in" link.
  - **E2E verified in-browser:** gate renders, `/api/analyze` 401s signed-out,
    sign-up sent a real magic link, the link click verified the account and
    opened the gate (session + UserButton live). Still open for production:
    create the Clerk **production** instance, add the deployed URL to allowed
    origins, and set both keys in Vercel before build.
  - **Deployed to Vercel 2026-08-22** via CLI: all six Clerk env vars pushed
    to Production + Preview (`vercel env add`; preview needs an explicit empty
    git-branch arg, `vercel env add NAME preview ""`), then `vercel --prod`.
    Live at **https://sga-analytics.vercel.app** — verified: gate renders with
    the dev publishable key, `/api/analyze` 401s signed-out, `/sign-in` and
    `/sign-up` serve 200, Clerk accepts the vercel.app origin, and the
    sign-in flow delivers a real magic link. NOTE: production runs the Clerk
    **development** instance keys (pk_test — shows a "Development mode" badge,
    Clerk-sender emails). Upgrading: create the production instance in the
    Clerk dashboard, then swap the two key vars in Vercel and redeploy.
    Existing-account sign-ups return 422 — expected; returning users use
    /sign-in (the gate's SignUp card links to it).
  - **Landing page trimmed (2026-08-22):** removed the "Website scoring" pill,
    the three SEO/GEO/AEO info cards, and the gate's icon/H2/subtext block —
    the copy repeated the acronyms five times. Hero is now just the H1 (the
    subhead and gate helper line were removed in a later trim); the gate is the
    Clerk card alone. Landing fits a single viewport
    (800px tall, verified local + production).
  - The Clerk card footer is decluttered via `clerkAppearance.elements.footerItem:
    { display: "none" }` — that one element holds BOTH the "Secured by clerk"
    branding and the orange "Development mode" badge; the sibling
    `cl-footerAction` ("Already have an account?") link stays visible. Verified
    live. (The badge exists because production runs dev keys; upgrading to a
    Clerk production instance removes it at the source.)
  - Card titles say "SGA Analytics" via `clerkLocalization` in
    `lib/clerk-theme.ts` (the app name "sga-analytics" isn't renamable through
    the CLI, and Clerk's Platform API isn't reachable with instance keys).
    GOTCHAS found the hard way: (1) `localization` passed to the RSC-exported
    `<ClerkProvider>` from a server layout is silently dropped — the provider
    must render from a client component (`components/ClerkProviderClient.tsx`);
    (2) `@clerk/localizations`' `enUS` is the FULL resource with dictionary
    keys spread FLAT at the top level (no `.dictionary` wrapper), and clerk-js
    ignores partial resources — spread `enUS` and override
    `signIn.start.title`/`signUp.start.title` (+ `titleCombined` variants).
    New dep: `@clerk/localizations`.

- **2026-08-22 (anonymous-first auth + quotas)** — Restored the landing page
  composition from `61a17a8` (Website scoring pill, hero subhead, audit form,
  SEO/GEO/AEO explainer cards) while keeping all later report features.
  - Replaced the hard full-page Clerk gate with a top-right **Sign in** control
    and Clerk's in-page `<SignIn withSignUp>` modal. The one email flow signs in
    existing users or transfers new emails to sign-up; both states use the
    neutral "Continue to SGA Analytics" title.
  - Added server-enforced free allowances: **1 anonymous audit** recorded in a
    signed HttpOnly cookie, then **5 member audits** stored in Clerk private
    metadata. `/api/quota` exposes only counts/status; both analyze routes
    reserve quota before provider work and return structured 401/429 errors.
    Invalid/private URLs are rejected before consuming an allowance.
  - The UI shows remaining audits, opens the modal automatically on the second
    anonymous attempt, and preserves the zero-config behavior when Clerk is off.
  - Verified: `tsc`, `eslint`, `next build`; local HTTP flow confirms 1 → 0,
    invalid URLs do not consume quota, and audit two returns
    `401 SIGN_IN_REQUIRED` without entering the analysis pipeline.

- **2026-08-22 (branded Clerk emails)** — Replaced Clerk's repetitive generic
  magic-link emails with one concise SGA Analytics message for both sign-in and
  sign-up, plus a matching new-device security notice.
  - Email-safe table HTML and Clerk Revolvapp editor markup live in `emails/`;
    `npm run email:sync` publishes both variants through the Clerk Backend API.
  - Subjects are now "Your SGA Analytics access link" and "New sign-in to SGA
    Analytics"; From local-part is `notifications`; body styling mirrors the
    site's teal visual system and uses one primary action.
  - Synced and read-back verified on the development instance. Clerk's forced
    `[Development]` prefix / `accounts.dev` sender remain while the public app
    uses `sga-analytics.vercel.app`: Clerk explicitly does not allow production
    keys on a `*.vercel.app` domain because its DNS records cannot be added.
  - A production Clerk instance has been created and configured for
    `sga.abid.work` (email-link only, password disabled, cross-device links
    allowed), and the subdomain is attached to the Vercel project. Cutover is
    intentionally pending the six Namecheap DNS records (one Vercel app record
    plus five Clerk CNAMEs); deploying the live keys before DNS resolves would
    break authentication. Vercel Production therefore remains on the working
    development keys.
  - The current Clerk plan rejects custom production email templates as a paid
    feature. The checked-in branded sources remain ready to sync after an
    upgrade; Clerk's default production email still removes the forced
    `[Development]` subject prefix.

## Planned — phase 7: persistence, rate limiting, and auth

> **Status: Track C (auth) SHIPPED 2026-08-22 — see the auth-gate entry above
> (implemented as a hard magic-link gate, not the optional perk originally
> sketched). Tracks A (rate limiting) and B (persistence) remain planned.**
> This section is the agreed next phase. It
> turns the single-page auditor into a platform: protects paid-provider spend,
> persists reports, and gates them behind accounts. All three additions stay
> **env-gated with never-throw fallbacks**, exactly like the existing external
> integrations (`aiSource`, `domainRating.source`, `psiMetrics.source`), so the
> app keeps its zero-config ethos — nothing here is a hard dependency at runtime.

Stack decision (web-research-backed, Aug 2026):

- **Cache / rate-limit store → Upstash Redis.** HTTP-based REST API (works in
  Edge middleware), free tier (10K commands/day), and it is what the deprecated
  Vercel KV was built on. Doubles as the durable second tier `lib/cache.ts`
  already documents as the future upgrade.
- **Database → Neon (serverless Postgres).** Direct successor to Vercel
  Postgres, native Vercel Marketplace integration, scale-to-zero, free tier.
  Ideal for audit history + score-over-time trends.
- **Auth → Clerk.** Easiest setup, free to 50K MAU, pre-built UI, native App
  Router middleware support. (Better Auth is the self-hosted alternative if we
  later want user data in our own Postgres; not chosen for phase 7 to keep
  setup minimal.)

Order is deliberate: **rate limiting first** (immediately protects the Ahrefs /
CrUX / Mistral spend the pipeline makes on every `/api/analyze*` call today),
**persistence second** (the product layer that makes people return), **auth
last** (once there is something auth-protected worth logging in for).

### Environment variables to add (`.env.example`, ALL still optional)

| Variable | Purpose |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis. Powers the durable cache tier + rate limiting. Without them: in-memory cache + no rate limit (today's behavior). |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon Postgres pooled (serverless driver) + direct (migrations). Without them: reports stay ephemeral (today's behavior). |
| `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk. Without them: the app is fully usable anonymous (today's behavior). |

### Track A — rate limiting + durable cache tier (do first)

1. `npm i @upstash/ratelimit @upstash/redis`. New `lib/upstash.ts` that builds
   the `Redis` + `Ratelimit` clients **only when env vars are present**, else
   exports `null` — mirroring the never-throw template (`psi.ts`, `domain-rating.ts`).
2. New `middleware.ts` (Edge runtime) applying a sliding-window limit to the
   `/api/analyze*` routes keyed by IP (pre-auth) — the real fire drill, since
   those routes fan out to **paid** Ahrefs/CrUX/Mistral on every call with zero
   throttling today. When Upstash is unset, middleware short-circuits to "no
   limit" so local dev and the zero-config deployment are unaffected.
3. Layer Upstash as an **env-gated second tier** in `lib/cache.ts`: on a miss in
   the in-memory `Map`, check Upstash (durable, cross-instance) before running
   the pipeline; on a write, write-through to both. The in-memory tier stays as
   a hot L1 to avoid a Redis hop on warm-instance repeats. The
   "skip caching when `psiMetrics === null`" rule is preserved.
4. `X-Cache` header gains `HIT-L1`/`HIT-L2`/`MISS` values; the stream's `cached`
   flag and the UI "Cached" pill already consume this path unchanged. The 429
   response from rate limiting returns a clean `{ error }` the existing UI
   error banner already renders.

### Track B — persistence (Neon Postgres)

1. `npm i @neondatabase/serverless` (HTTP driver — no TCP pool exhaustion on
   serverless) + `drizzle-orm` + `drizzle-kit` for typed schema + migrations.
   New `lib/db.ts` client (lazy, env-gated). Schema in `lib/db/schema.ts`.
2. **Schema (minimal, v1):**
   - `reports(id uuid pk, url text, final_url text, overall int, seo int, aeo
     int, geo int, speed int, technical int, dr int, dr_source text,
     analyzed_at timestamptz, owner_user_id text null, payload jsonb)`. The
     full `AnalyzeResult` is stored as `payload jsonb` (the type already
     serializes cleanly to JSON); the top-level score columns are denormalized
     for cheap trend queries without a jsonb probe.
   - Index on `(url, analyzed_at desc)` for history; index on
     `owner_user_id` for "my reports" once Track C lands.
3. **Persistence is a side effect, never on the critical path:** after
   `analyzeUrl` resolves, `analyzeUrlCached` fires-and-forgets a
   `persistReport(result)` write wrapped in try/catch (never throws up to the
   route handler — same rule as every other external call). The report is still
   returned from the in-memory/Upstash cache as today.
4. New `app/report/[id]/route.ts` → renders a stored report (read from Postgres
   by id). This unlocks **shareable report URLs** — the highest organic-growth
   lever — without changing the live-audit flow. Public by default in v1;
   owner-gating comes with Track C.
5. When `DATABASE_URL` is unset, persistence and `/report/[id]` are skipped
   entirely (the live-audit UX is unchanged) — preserves zero-config.

### Track C — auth (Clerk, do last)

1. `npm i @clerk/nextjs`. Env-gated: when `CLERK_SECRET_KEY` is unset, Clerk
   middleware is a no-op and the app is fully usable anonymous.
2. Wire `clerkMiddleware()` into the existing `middleware.ts` from Track A
   (compose: rate-limit first, then auth). Add `/sign-in` and `/sign-up` routes
   via Clerk's App Router helpers; surface a "Sign in" control in `AnalyzerApp`'s
   nav (next to the existing "Free URL audit" pill).
3. **Owner-scoped reports:** on the persist write (Track B), set
   `owner_user_id` from `auth()` when authenticated. "My reports" /
   score-over-time views are gated behind `auth().userId`; the public
   `/report/[id]` stays open (v1 decision — shareability > exclusivity).
4. **Rate-limit tiering (optional, if time allows):** when authenticated, key
   the Upstash limiter on `userId` with a higher budget than the anonymous
   IP-keyed limit. Anonymous-first access is preserved — auth is a perk, not a
   gate, matching the product's "free URL audit" positioning.

### Non-goals (explicitly out of scope for phase 7)

- The **in-house Domain Rating** and **in-house Speed runner** remain the
  separate, separately-validated roadmap items already documented above. Phase
  7 neither starts nor blocks them.
- No billing, no orgs/teams, no scheduled re-audit cron yet — those are natural
  phase-8 follow-ons once persistence + auth are live.

### Acceptance criteria

- `tsc`, `eslint`, `next build` all pass.
- **Zero-config path unchanged:** with none of the new env vars set, a live
  `/api/analyze` returns identical results to phase 6 (in-memory cache, no rate
  limit, no persistence, no auth), and no new runtime errors surface.
- With Upstash env vars set: repeat analysis of a URL within the TTL is served
  from the durable tier across cold starts; hammering `/api/analyze` from one
  IP returns HTTP 429 past the limit.
- With `DATABASE_URL` set: a fresh analysis is persisted and re-fetchable at
  `/report/<id>`; the live audit response latency is unchanged (persistence is
  async fire-and-forget).
- With Clerk env vars set: sign-in/sign-up work, "My reports" shows the
  authenticated user's persisted reports, and anonymous audits still work end
  to end.
- All three additions degrade cleanly to today's behavior when their env vars
  are absent (verified by running the build + a local audit with each tier
  individually disabled).
  - Verified: `tsc`, `eslint`, and `next build` all pass; both route handlers
    compile as dynamic (`ƒ`) functions.
