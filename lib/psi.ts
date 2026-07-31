import type { PsiMetrics } from "./types";

/**
 * Real Core Web Vitals via the Google PageSpeed Insights API v5
 * (https://pagespeedonline.googleapis.com).
 *
 *   GET /v5/runPagespeed?url=...&strategy=mobile&category=performance&key=...
 *
 * One call bundles:
 *   - lighthouseResult        -> LAB data (single mobile Lighthouse run)
 *   - loadingExperience       -> FIELD data (CrUX, 28-day p75, for THIS url)
 *   - originLoadingExperience -> FIELD data (CrUX, 28-day, origin-level)
 *
 * Fallback path: whenever no API key is set, the request fails, or the response
 * is unparseable, this returns `null` so `scoreSpeed` falls back to its on-page
 * heuristics. This mirrors `lib/domain-rating.ts`: env-gated, best-effort, and
 * it NEVER throws — a failure degrades silently to the heuristic.
 */

const PSI_ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CRUX_ENDPOINT =
  "https://chromeuxreport.googleapis.com/v1/records:queryRecord";
// Phase 5 latency contract: field data must never dominate the report.
const CRUX_TIMEOUT_MS = 1_500;
// A mobile Lighthouse run commonly needs 8–15 seconds. The UI shows live
// progress, so favor a real result over an inaccurately labeled fast fallback.
const PSI_TIMEOUT_MS = 18_000;

/** --- Field (CrUX) shape ------------------------------------------------ */

type FieldOverall = "FAST" | "AVERAGE" | "SLOW" | "NONE";
type FieldMetric = {
  percentile?: number;
  category?: string;
};
type LoadingExperience = {
  overall_category?: string;
  metrics?: Record<string, FieldMetric>;
};

// PSI field metric keys are SCREAMING_SNAKE_CASE.
const FIELD_LCP = "LARGEST_CONTENTFUL_PAINT_MS";
const FIELD_CLS = "CUMULATIVE_LAYOUT_SHIFT_SCORE";
const FIELD_INP = "INTERACTION_TO_NEXT_PAINT";
const FIELD_FCP = "FIRST_CONTENTFUL_PAINT_MS";
const FIELD_TTFB = "EXPERIMENTAL_TIME_TO_FIRST_BYTE";

/**
 * Parse the CrUX field-data block. Returns null when there is no field data
 * (`overall_category === "NONE"` or the metrics object is missing).
 *
 * CLS note: PSI ships the CLS percentile *100 (0.10 is sent as 10); normalize
 * it back to a unitless ratio. Guarded by `raw >= 1` so a correctly-scaled value
 * is passed through untouched.
 */
export function parseFieldMetrics(
  lexp: LoadingExperience | undefined
): PsiMetrics["field"] {
  const metrics = lexp?.metrics;
  if (!metrics) return null;

  const overall = lexp?.overall_category;
  if (!overall || overall === "NONE") return null;

  const num = (key: string): number | null => {
    const v = metrics[key]?.percentile;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const rawCls = num(FIELD_CLS);
  const cls =
    rawCls === null ? null : rawCls >= 1 ? rawCls / 100 : rawCls;

  const normalized = overall.toUpperCase() as FieldOverall;
  return {
    lcpMs: num(FIELD_LCP),
    inpMs: num(FIELD_INP),
    cls,
    fcpMs: num(FIELD_FCP),
    ttfbMs: num(FIELD_TTFB),
    overall: normalized,
  };
}

/** --- Lab (Lighthouse) shape ------------------------------------------- */

type LabAudit = { numericValue?: number; score?: number };
type LighthouseResult = {
  categories?: {
    performance?: { score?: number | null };
  };
  audits?: Record<string, LabAudit | undefined>;
};

// Lighthouse audit ids (kebab-case).
const LAB_LCP = "largest-contentful-paint";
const LAB_CLS = "cumulative-layout-shift";
const LAB_TBT = "total-blocking-time";
const LAB_FCP = "first-contentful-paint";
const LAB_SI = "speed-index";
const LAB_TTFB = "server-response-time";

/**
 * Parse the Lighthouse lab block. Returns null only when the audits object or
 * the core metrics are missing (a "successful" PSI response with no lab data
 * isn't usable for scoring, so treat it as no-lab).
 */
export function parseLabMetrics(
  lh: LighthouseResult | undefined
): PsiMetrics["lab"] {
  const audits = lh?.audits;
  const num = (id: string): number | null => {
    const v = audits?.[id]?.numericValue;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const lcpMs = num(LAB_LCP);
  const tbtMs = num(LAB_TBT);
  if (lcpMs === null || tbtMs === null) return null; // core metrics missing

  const rawPerf = lh?.categories?.performance?.score;
  const performanceScore =
    typeof rawPerf === "number" && Number.isFinite(rawPerf)
      ? Math.round(clampPercent(rawPerf) * 100)
      : 0;

  const cls = num(LAB_CLS) ?? 0;

  return {
    lcpMs,
    cls: cls >= 1 ? cls / 100 : cls, // Lighthouse CLS is already unitless, but guard
    tbtMs,
    fcpMs: num(LAB_FCP) ?? 0,
    speedIndexMs: num(LAB_SI) ?? 0,
    ttfbMs: num(LAB_TTFB) ?? 0,
    performanceScore,
  };
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** --- PSI response ----------------------------------------------------- */

type PsiResponse = {
  lighthouseResult?: LighthouseResult;
  loadingExperience?: LoadingExperience;
  originLoadingExperience?: LoadingExperience;
};

async function fetchPsi(url: string): Promise<PsiMetrics | null> {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return null;

  const endpoint = new URL(PSI_ENDPOINT);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", "mobile");
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.set("key", key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as PsiResponse;

    // Prefer per-URL field data; fall back to origin-level when the URL record
    // is empty (common for low-traffic pages).
    const field =
      parseFieldMetrics(data.loadingExperience) ??
      parseFieldMetrics(data.originLoadingExperience);
    const lab = parseLabMetrics(data.lighthouseResult);

    // Need at least lab data for a usable result; field may legitimately be null.
    if (!lab) return null;

    return { field, lab, strategy: "mobile", source: "psi" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type CruxMetric = { percentiles?: { p75?: number } };
type CruxResponse = {
  record?: {
    metrics?: Record<string, CruxMetric | undefined>;
  };
};

function cruxP75(data: CruxResponse, key: string): number | null {
  const value = data.record?.metrics?.[key]?.percentiles?.p75;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchCrux(url: string): Promise<PsiMetrics | null> {
  const key = process.env.PAGESPEED_API_KEY;
  if (!key) return null;

  const endpoint = new URL(CRUX_ENDPOINT);
  endpoint.searchParams.set("key", key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRUX_TIMEOUT_MS);

  const query = async (body: { url?: string; origin?: string }) => {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        formFactor: "PHONE",
        metrics: [
          "largest_contentful_paint",
          "interaction_to_next_paint",
          "cumulative_layout_shift",
          "first_contentful_paint",
          "experimental_time_to_first_byte",
        ],
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as CruxResponse;
  };

  try {
    // Prefer page-level data. Low-traffic URLs frequently have no record, so
    // retry once at origin level while sharing the same 1.5s deadline.
    const page = await query({ url });
    const data = page ?? (await query({ origin: new URL(url).origin }));
    if (!data?.record?.metrics) return null;

    const clsRaw = cruxP75(data, "cumulative_layout_shift");
    const field: NonNullable<PsiMetrics["field"]> = {
      lcpMs: cruxP75(data, "largest_contentful_paint"),
      inpMs: cruxP75(data, "interaction_to_next_paint"),
      cls: clsRaw === null ? null : clsRaw >= 1 ? clsRaw / 100 : clsRaw,
      fcpMs: cruxP75(data, "first_contentful_paint"),
      ttfbMs: cruxP75(data, "experimental_time_to_first_byte"),
      overall: "NONE",
    };
    if (field.lcpMs === null && field.inpMs === null && field.cls === null) {
      return null;
    }
    return { field, lab: null, strategy: "mobile", source: "crux" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Public entry: fetch real Core Web Vitals for a URL. Returns null when no key
 * is configured, the request fails/times out, or the response is unusable — in
 * all those cases `scoreSpeed` degrades to on-page heuristics.
 *
 * PSI (Lighthouse lab data) is the default. CrUX field data is the gold
 * standard, but a single Google API key is often authorized for only one of the
 * two services (a PSI key is commonly `API_KEY_SERVICE_BLOCKED` for CrUX); in
 * that case the CrUX call just burns ~0.8s before returning null. Set
 * `SPEED_DATA_MODE=crux` to try field data first (needs a key authorized for
 * the Chrome UX Report API).
 */
export async function getPsiMetrics(url: string): Promise<PsiMetrics | null> {
  if (process.env.SPEED_DATA_MODE === "crux") {
    return (await fetchCrux(url)) ?? fetchPsi(url);
  }
  return fetchPsi(url);
}
