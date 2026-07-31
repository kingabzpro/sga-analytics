import { normalizeUrl } from "./fetch-page";
import { analyzeUrl, type AnalyzeProgress } from "./analyze";
import type { AnalyzeResult } from "./types";

/**
 * Phase 6 — a 10-minute application-level analysis cache.
 *
 * Stops repeat analyses of the same URL from re-running the full external-calls
 * pipeline (Ahrefs → CrUX/PSI → Mistral → broken-link probe) within the TTL. Two
 * concerns, both handled here:
 *
 *   - **Completed results** are stored TTL'd (lazy eviction on read, oldest-first
 *     eviction at `MAX_ENTRIES` to bound memory).
 *   - **In-flight requests are coalesced**: two near-simultaneous requests for the
 *     same URL share a single running `analyzeUrl` promise instead of double-
 *     spending the same paid/rate-limited provider calls.
 *
 * Design notes:
 *   - `analyzeUrl` is kept a pure analysis function; the cache is a thin wrapper.
 *   - This is an **in-memory** cache (module-level Maps). On serverless it
 *     persists only within a warm instance — cold starts and concurrent instances
 *     do not share it. A durable store (Vercel KV / Upstash) is a documented
 *     future upgrade; it would layer in here behind an env-gated second tier.
 *   - On a completed hit, `result.analyzedAt` keeps its original timestamp so the
 *     report stays honest about when the page was actually fetched.
 */

/** How long a completed analysis is served before it must be re-run. */
export const ANALYZE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
/** Upper bound on cached entries (unbounded-growth guard). */
const MAX_ENTRIES = 100;

type Stored = { result: AnalyzeResult; storedAt: number };

// completed results, TTL'd
const store = new Map<string, Stored>();
// in-flight analyses → request coalescing
const inflight = new Map<string, Promise<AnalyzeResult>>();

/**
 * Deterministic cache key for a raw URL input. Runs `normalizeUrl` first (which
 * throws on invalid/private/local URLs — the same errors the route handlers map
 * to 400/502 today), then canonicalizes: lowercase host + pathname (trailing
 * slash stripped) + the query string. `http://` upgrades to `https://` so a
 * scheme difference doesn't fragment the cache.
 */
export function cacheKey(input: string): string {
  const url = normalizeUrl(input);
  const path = url.pathname.replace(/\/$/, "") || "/";
  return `${url.protocol}//${url.hostname.toLowerCase()}${path}${url.search}`;
}

/** Read a non-stale cached result, or null. Lazily evicts expired entries. */
export function readCache(key: string): { result: AnalyzeResult; ageMs: number } | null {
  const hit = store.get(key);
  if (!hit) return null;
  const ageMs = Date.now() - hit.storedAt;
  if (ageMs > ANALYZE_CACHE_TTL_MS) {
    store.delete(key);
    return null;
  }
  return { result: hit.result, ageMs };
}

/** Store a completed result. Evicts the oldest entry when at capacity. */
export function writeCache(key: string, result: AnalyzeResult): void {
  // Evict oldest by storedAt once we are at capacity.
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, v] of store) {
      if (v.storedAt < oldestAt) {
        oldestAt = v.storedAt;
        oldestKey = k;
      }
    }
    if (oldestKey) store.delete(oldestKey);
  }
  store.set(key, { result, storedAt: Date.now() });
}

/** Format an age in ms as a compact, human-friendly relative phrase. */
function fmtAge(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min === 1) return "1 min ago";
  return `${min} min ago`;
}

/**
 * The cached entry point used by the route handlers. Returns the result plus a
 * `cached` flag and the cache age (0 on a fresh/in-flight run) so the UI can
 * badge it. On a completed or in-flight hit the provider pipeline is skipped.
 *
 * Throws exactly what `analyzeUrl`/`normalizeUrl` would — the route handlers'
 * existing error mapping is unchanged.
 */
export async function analyzeUrlCached(
  rawUrl: string,
  options?: { onProgress?: (event: AnalyzeProgress) => void }
): Promise<{ result: AnalyzeResult; cached: boolean; ageMs: number }> {
  const key = cacheKey(rawUrl); // may throw — same errors as analyzeUrl
  const onProgress = options?.onProgress ?? (() => {});

  // 1. Completed hit — serve instantly, skip the pipeline.
  const hit = readCache(key);
  if (hit) {
    onProgress({
      stage: "cache",
      message: `Served from cache · analyzed ${fmtAge(hit.ageMs)}`,
    });
    return { result: hit.result, cached: true, ageMs: hit.ageMs };
  }

  // 2. In-flight hit — join the running analysis instead of starting a second.
  const running = inflight.get(key);
  if (running) {
    onProgress({
      stage: "cache",
      message: "An analysis of this URL is already running — joining it",
    });
    const result = await running;
    return { result, cached: false, ageMs: 0 };
  }

  // 3. Miss — run it, register the promise so concurrent callers join us, and
  //    cache the result when it resolves. On failure we clear the inflight slot
  //    (never poisoning it) and rethrow so the handler reports the error.
  const promise = analyzeUrl(rawUrl, options).then((result) => {
    writeCache(key, result);
    inflight.delete(key);
    return result;
  });
  // Attach the rejection cleanup *before* publishing the promise so a rejection
  // between set/await can't strand the slot.
  promise.catch(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);

  const result = await promise;
  return { result, cached: false, ageMs: 0 };
}
