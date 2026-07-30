import type { BrokenLink, PageSignals } from "./types";
import { isFetchable } from "./fetch-page";

// USER_AGENT is defined locally in fetch-page and not exported; keep this copy
// consistent with it.
const USER_AGENT =
  "SGA-Analytics/0.1 (+https://github.com/kingabzpro/sga-analytics; website auditor)";

/** Max outbound links we will HEAD-check (cost/latency guard). */
const MAX_LINKS = 10;
/** Per-link HEAD timeout. */
const LINK_TIMEOUT_MS = 1_500;
/** Max concurrent HEAD requests. */
const CONCURRENCY = 10;

/**
 * Probe outbound links for reachability. Dedupes, caps at MAX_LINKS, and filters
 * through the SSRF guard (isFetchable) so private/local hosts are never fetched.
 * Never throws. Only definitive HTTP 404/410 responses are marked broken;
 * bot blocks, rate limits, and network uncertainty are marked unverified.
 *
 * Returns BrokenLink[] for the checked subset (the scorer treats "no links" as
 * full credit, so a capped/empty result is fine).
 */
export async function checkLinks(signals: PageSignals): Promise<BrokenLink[]> {
  // External outbound links only; dedupe by URL; cap the set.
  const unique = Array.from(
    new Set(
      signals.links
        .filter((l) => !l.internal && isFetchable(l.href))
        .map((l) => l.href)
    )
  ).slice(0, MAX_LINKS);

  if (unique.length === 0) return [];

  // Run in bounded-concurrency batches.
  const results: BrokenLink[] = [];
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(batch.map((url) => probeOne(url)));
    results.push(...settled);
  }
  return results;
}

/** HEAD (fall back to GET if HEAD is unsupported) one URL. Never throws. */
async function probeOne(url: string): Promise<BrokenLink> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
    });
    // Some servers reject HEAD (405); retry once with GET but don't read body.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      });
      // Drain minimally to free the connection.
      await res.arrayBuffer().catch(() => {});
    }
    const state: BrokenLink["state"] =
      res.status === 404 || res.status === 410
        ? "broken"
        : res.status >= 200 && res.status < 400
          ? "reachable"
          : "unverified";
    return { url, status: res.status, ok: state !== "broken", state };
  } catch {
    // A timeout/network error from our server is not proof that the public link
    // is broken for a browser, so preserve it as unverified.
    return { url, status: null, ok: true, state: "unverified" };
  } finally {
    clearTimeout(timer);
  }
}
