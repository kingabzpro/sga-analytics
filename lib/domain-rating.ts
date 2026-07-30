import type { DomainRating, PageSignals } from "./types";
import { clamp, clamp01, ramp } from "./score-utils";

/**
 * Domain Rating (off-page authority).
 *
 * Primary path: Ahrefs' official free Domain Rating endpoint. It returns the
 * actual 0..100 logarithmic Ahrefs DR from their backlink index.
 *
 * Secondary path: Open PageRank (https://openpagerank.keywordseverywhere.com).
 *   POST /v1/domains/bulk  with header  Authorization: Bearer opr_live_...
 *   body: { domains: [host], include_history: false }
 *   result fields: open_page_rank (0..10), rank (1 = best), referring_domains
 *
 * Fallback path: a rough heuristic estimate from on-page trust signals, used
 * whenever no API key is set or the request fails. It is clearly tagged
 * `source: "heuristic"` and must never be shown as a real authority number.
 *
 * The whole function is best-effort: it never throws — a failure degrades to
 * the heuristic so the analyze pipeline always returns a DomainRating.
 */

const OPR_ENDPOINT =
  "https://openpagerank.keywordseverywhere.com/v1/domains/bulk";
const AHREFS_ENDPOINT =
  "https://api.ahrefs.com/v3/public/domain-rating-free";
const AHREFS_TIMEOUT_MS = 3_000;
const OPR_TIMEOUT_MS = 4_000;

type AhrefsResponse = {
  domain_rating?: {
    domain_rating?: number;
    license?: string;
    warning?: string;
  };
};

type OprResponse = {
  as_of?: string;
  results?: {
    domain: string;
    found: boolean;
    open_page_rank?: number;
    rank?: number;
    referring_domains?: number;
  }[];
};

function resolveHost(input: string): string {
  try {
    const u = new URL(input.startsWith("http") ? input : `https://${input}`);
    // strip leading www. for a cleaner matching key
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return input.replace(/^www\./i, "");
  }
}

/** Map the raw 0..10 OPR value to a 0..100 score. */
function oprToScore(opr: number): number {
  return clamp(Math.round(opr * 10));
}

async function fetchAhrefsDomainRating(
  host: string
): Promise<DomainRating | null> {
  const endpoint = new URL(AHREFS_ENDPOINT);
  endpoint.searchParams.set("target", host);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AHREFS_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    // Authentication becomes mandatory on 2026-08-10. The endpoint and keys
    // remain free; accepting the key now makes deployments future-proof.
    const key = process.env.AHREFS_API_KEY;
    if (key) headers.Authorization = `Bearer ${key}`;

    const res = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
      headers,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as AhrefsResponse;
    const score = data.domain_rating?.domain_rating;
    if (typeof score !== "number" || !Number.isFinite(score)) return null;

    return {
      score: clamp(Math.round(score)),
      rawRank: null,
      globalRank: null,
      referringDomains: null,
      source: "ahrefs",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenPageRank(host: string): Promise<DomainRating | null> {
  const key = process.env.OPEN_PAGE_RANK_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPR_TIMEOUT_MS);

  try {
    const res = await fetch(OPR_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ domains: [host], include_history: false }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as OprResponse;
    const entry = data.results?.[0];
    if (!entry || !entry.found || typeof entry.open_page_rank !== "number") {
      // Known domain but no data, or unknown domain — fall back.
      return null;
    }

    return {
      score: oprToScore(entry.open_page_rank),
      rawRank: Math.round(entry.open_page_rank * 10) / 10,
      globalRank: typeof entry.rank === "number" ? entry.rank : null,
      referringDomains:
        typeof entry.referring_domains === "number" ? entry.referring_domains : null,
      source: "openpagerank",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Heuristic estimate used only when no Open PageRank key is configured or the
 * request fails. It blends a few on-page trust/quality signals into a modest
 * 0..100 number. It intentionally stays conservative (rarely above ~55) because
 * real backlink authority cannot be inferred from a single page.
 */
function heuristicRating(host: string, signals: PageSignals): DomainRating {
  const httpsScore = signals.https ? 1 : 0;
  const schemaScore = clamp01(signals.jsonLdTypes.length / 3); // up to 3 types
  const externalLinks = signals.links.filter((l) => !l.internal).length;
  const citations = clamp01(externalLinks / 10); // 10+ external links -> full
  const depth = ramp(signals.wordCount, [150, 600]); // deeper content -> more trust
  const trustPaths = signals.links.some((l) =>
    /about|contact|privacy|team|author|trust/i.test(l.href + " " + l.text)
  );
  const eeat = trustPaths || signals.hasAuthor ? 1 : 0;

  const blend =
    httpsScore * 0.18 +
    schemaScore * 0.17 +
    citations * 0.2 +
    depth * 0.2 +
    eeat * 0.1 +
    0.15; // small baseline so no site reads 0/100

  // Cap conservatively — heuristic can't credibly claim high authority.
  const score = clamp(Math.round(clamp01(blend) * 55));

  return {
    score,
    rawRank: null,
    globalRank: null,
    referringDomains: null,
    source: "heuristic",
  };
}

export async function getDomainRating(
  hostInput: string,
  opts?: { signals?: PageSignals }
): Promise<DomainRating> {
  const host = resolveHost(hostInput);

  const ahrefs = await fetchAhrefsDomainRating(host);
  if (ahrefs) return ahrefs;

  const live = await fetchOpenPageRank(host);
  if (live) return live;

  // No key / request failed -> heuristic estimate.
  if (opts?.signals) return heuristicRating(host, opts.signals);

  // Absolute last resort if no signals available.
  return {
    score: 0,
    rawRank: null,
    globalRank: null,
    referringDomains: null,
    source: "heuristic",
  };
}
