export type CheckResult = {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  detail: string;
  /**
   * Optional continuous credit for this check, in the range 0..1.
   * When omitted, the check is scored as binary via `passed` (1 if passed, else 0).
   * When set, it overrides the binary credit so a check can earn partial credit
   * for a "nearly good" signal (e.g. a slightly-too-long title). `passed` should
   * still be set truthy when partialScore >= the pass threshold the check uses,
   * so the checklist UI still shows a ✓ where appropriate.
   */
  partialScore?: number;
};

/**
 * A single outbound link and its HTTP reachability. Phase 4 broken-link check.
 * `status` is the HTTP status code, or null when the request failed/timed out
 * (treated as broken). `ok` is derived: 2xx/3xx reachable, anything else broken.
 */
export type BrokenLink = {
  url: string;
  status: number | null;
  ok: boolean;
};

export type CategoryScore = {
  score: number;
  checks: CheckResult[];
  recommendations: string[];
};

export type PageSignals = {
  url: string;
  finalUrl: string;
  statusCode: number;
  https: boolean;
  title: string;
  metaDescription: string;
  canonical: string | null;
  viewport: string | null;
  robotsMeta: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  headings: { level: number; text: string }[];
  images: { src: string; alt: string | null }[];
  links: { href: string; text: string; internal: boolean }[];
  /** Phase 4: image dimension coverage (CLS cause) — count of <img> with both
   *  width+height attributes vs total. */
  imagesWithDimensions: number;
  imagesMissingDimensions: number;
  jsonLdTypes: string[];
  jsonLdRaw: unknown[];
  hasFaqSchema: boolean;
  hasHowToSchema: boolean;
  hasQaSchema: boolean;
  wordCount: number;
  firstParagraph: string;
  hasMain: boolean;
  hasArticle: boolean;
  hasHeader: boolean;
  hasAuthor: boolean;
  hasDate: boolean;
  dateDetail: string | null;
  /** Phase 4 GEO/AEO text signals (Princeton GEO paper). */
  statisticsCount: number;
  quotationCount: number;
  readabilityScore: number;
  hasDefinition: boolean;
  html: string;
  bodyHtml: string;
  /** Phase 4: response headers + redirect info for the Technical category. */
  responseHeaders: Record<string, string>;
  redirected: boolean;
  robotsTxt: string | null;
  robotsTxtUrl: string | null;
  sitemapFound: boolean;
  sitemapUrl: string | null;
  llmsTxtFound: boolean;
  llmsTxtUrl: string | null;
  aiBots: { name: string; allowed: boolean | null }[];
  loadTimeMs: number;
};

export type AnalyzeResult = {
  url: string;
  finalUrl: string;
  analyzedAt: string;
  overallScore: number;
  seo: CategoryScore;
  aeo: CategoryScore;
  geo: CategoryScore;
  speed: CategoryScore;
  /** Phase 4: 5th scored category — technical/best-practices health. */
  technical: CategoryScore;
  signals: {
    title: string;
    metaDescription: string;
    wordCount: number;
    jsonLdTypes: string[];
    hasRobotsTxt: boolean;
    hasSitemap: boolean;
    hasLlmsTxt: boolean;
    aiBots: { name: string; allowed: boolean | null }[];
    loadTimeMs: number;
    htmlSizeBytes: number;
  };
  /** Off-page authority rating. Standalone metric — NOT part of the on-page Overall. */
  domainRating: DomainRating;
  /**
   * Real Core Web Vitals from PageSpeed Insights v5. `null` when no API key is
   * set or the call fails — in that case Speed is scored from on-page heuristics.
   */
  psiMetrics: PsiMetrics | null;
  /** Phase 4: LLM citability probe ("would ChatGPT cite this?"). */
  citability: CitabilityProbe;
  aiSummary: string | null;
  aiRecommendations: string[];
  aiSource: "mistral" | "rules";
};

/**
 * Off-page domain authority (backlink-based).
 *
 * `source: "openpagerank"` is authoritative — fetched live from Open PageRank
 * (https://openpagerank.keywordseverywhere.com). `source: "heuristic"` is a
 * rough on-page-derived estimate used only when no API key is set or the
 * request fails; it must never be presented as a real authority number.
 *
 * `score` is always normalized to 0..100. For Open PageRank, `rawRank` is the
 * raw 0..10 value (one decimal) and `globalRank`/`referringDomains` carry the
 * provider's auxiliary metrics. Heuristic values leave those null.
 */
export type DomainRating = {
  score: number;
  rawRank: number | null;
  globalRank: number | null;
  referringDomains: number | null;
  source: "openpagerank" | "heuristic";
};

/**
 * Real Core Web Vitals from the Google PageSpeed Insights API v5
 * (https://pagespeedonline.googleapis.com), bundling CrUX field data with a
 * Lighthouse lab run for one URL on mobile.
 *
 * `field` (CrUX, 28-day p75 real-user) is the gold standard but is absent for
 * low-traffic URLs/origins, hence nullable. `lab` (a single mobile Lighthouse
 * run) is present whenever PSI succeeds and fills in field gaps. `source` is
 * always "psi" — a null `PsiMetrics` on `AnalyzeResult` signals "no key / call
 * failed", in which case Speed is scored from on-page heuristics instead.
 */
export type PsiMetrics = {
  field: {
    lcpMs: number | null;
    inpMs: number | null;
    cls: number | null;
    fcpMs: number | null;
    ttfbMs: number | null;
    overall: "FAST" | "AVERAGE" | "SLOW" | "NONE";
  } | null;
  lab: {
    lcpMs: number;
    cls: number;
    tbtMs: number;
    fcpMs: number;
    speedIndexMs: number;
    ttfbMs: number;
    performanceScore: number; // 0..100
  } | null;
  strategy: "mobile";
  source: "psi";
};

export type AnalyzeError = {
  error: string;
};

/**
 * LLM citability probe — "would ChatGPT cite this page?" (phase 4).
 *
 * The page is judged against an auto-derived target query (H1/title). The
 * Mistral path returns a verdict + 0–100 score + gaps; the rules fallback
 * derives a conservative estimate from the static GEO/AEO scores. Never blocks
 * the response — a failure degrades to `source: "rules"`.
 */
export type CitabilityProbe = {
  query: string;
  verdict: "would-cite" | "partial" | "would-not-cite";
  score: number;
  gaps: string[];
  reason: string;
  source: "mistral" | "rules";
};
