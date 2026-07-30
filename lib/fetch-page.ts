const USER_AGENT =
  "SGA-Analytics/0.1 (+https://github.com/kingabzpro/sga-analytics; website auditor)";

const PAGE_FETCH_TIMEOUT_MS = 3_000;
const AUX_FETCH_TIMEOUT_MS = 1_000;
const EXTRACT_FALLBACK_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 2_000_000;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

/** SSRF guard: blocks private/loopback/link-local/metadata hosts. Exported so
 *  the broken-link checker (lib/check-links.ts) reuses the same guard. */
export function isPrivateIp(hostname: string): boolean {
  if (BLOCKED_HOSTS.has(hostname.toLowerCase())) return true;
  // IPv4 private / link-local / loopback
  const m = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Normalize a user URL to a validated http(s) URL, rejecting private/local
 *  hosts. Exported for the broken-link checker. Throws on invalid/unsafe input. */
export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("URL is required");

  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    withProtocol = `https://${trimmed}`;
  }

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }

  if (isPrivateIp(url.hostname)) {
    throw new Error("Private or local URLs are not allowed");
  }

  return url;
}

/** True if the hostname is safe to fetch (http(s) and not private/local). Never
 *  throws — used by the link checker to filter targets defensively. */
export function isFetchable(href: string): boolean {
  try {
    const u = normalizeUrl(href);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchText(
  url: string,
  options?: { accept?: string; timeoutMs?: number }
): Promise<{
  ok: boolean;
  status: number;
  text: string;
  finalUrl: string;
  ms: number;
  headers: Record<string, string>;
  redirected: boolean;
}> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? PAGE_FETCH_TIMEOUT_MS
  );

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: options?.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);

    // Flatten response headers to a lowercased-key record.
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      ok: res.ok,
      status: res.status,
      text,
      finalUrl: res.url || url,
      ms: Date.now() - start,
      headers,
      redirected: res.redirected,
    };
  } finally {
    clearTimeout(timer);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Convert the useful subset of Jina Reader markdown into semantic HTML so the
 * existing extraction/scoring pipeline can operate without pretending this is
 * the origin's raw HTML. */
function readerMarkdownToHtml(markdown: string): string {
  const title = markdown.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const content = markdown.split(/^Markdown Content:\s*$/m)[1] ?? markdown;
  const blocks = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const body = blocks
    .map((block) => {
      const heading = block.match(/^(#{1,3})\s+([\s\S]+)$/);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${escapeHtml(heading[2].replace(/\n+/g, " "))}</h${level}>`;
      }
      let text = escapeHtml(block.replace(/\n+/g, " "));
      text = text.replace(
        /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)[^)]*\)/g,
        '<img src="$2" alt="$1">'
      );
      text = text.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+)[^)]*\)/g,
        '<a href="$2">$1</a>'
      );
      return `<p>${text}</p>`;
    })
    .join("");
  return `<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body><main>${body}</main></body></html>`;
}

async function fetchViaReader(url: string) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTRACT_FALLBACK_TIMEOUT_MS);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: { Accept: "text/plain", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const markdown = await res.text();
    if (!markdown.includes("Markdown Content:") || markdown.length < 200) return null;
    return {
      ok: true,
      status: 200,
      text: readerMarkdownToHtml(markdown),
      finalUrl: url,
      ms: Date.now() - startedAt,
      headers: {} as Record<string, string>,
      redirected: false,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type FetchedPage = {
  url: string;
  finalUrl: string;
  statusCode: number;
  html: string;
  loadTimeMs: number;
  robotsTxt: string | null;
  robotsTxtUrl: string | null;
  sitemapFound: boolean;
  sitemapUrl: string | null;
  llmsTxtFound: boolean;
  llmsTxtUrl: string | null;
  /** Phase 4: response headers + redirect info for the Technical category. */
  responseHeaders: Record<string, string>;
  redirected: boolean;
  fetchSource: "direct" | "reader";
};

export async function fetchPageBundle(inputUrl: string): Promise<FetchedPage> {
  const url = normalizeUrl(inputUrl);
  const origin = url.origin;

  let page = await fetchText(url.toString());
  let fetchSource: FetchedPage["fetchSource"] = "direct";
  if ([401, 403, 429].includes(page.status)) {
    const extracted = await fetchViaReader(url.toString());
    if (extracted) {
      page = extracted;
      fetchSource = "reader";
    }
  }
  if (!page.ok && page.status >= 400) {
    throw new Error(`Could not fetch page (HTTP ${page.status})`);
  }
  if (!page.text || page.text.trim().length < 20) {
    throw new Error("Page returned empty or unreadable HTML");
  }

  const robotsUrl = `${origin}/robots.txt`;
  const llmsUrl = `${origin}/llms.txt`;
  const defaultSitemap = `${origin}/sitemap.xml`;

  const [robots, llms, sitemap] = await Promise.all([
    fetchText(robotsUrl, { accept: "text/plain,*/*", timeoutMs: AUX_FETCH_TIMEOUT_MS }).catch(() => null),
    fetchText(llmsUrl, { accept: "text/plain,*/*", timeoutMs: AUX_FETCH_TIMEOUT_MS }).catch(() => null),
    fetchText(defaultSitemap, {
      accept: "application/xml,text/xml,text/plain,*/*",
      timeoutMs: AUX_FETCH_TIMEOUT_MS,
    }).catch(() => null),
  ]);

  const robotsOk =
    robots &&
    robots.ok &&
    robots.text.length > 0 &&
    !/^\s*<!doctype html/i.test(robots.text) &&
    !/^\s*<html/i.test(robots.text);

  const llmsOk =
    llms &&
    llms.ok &&
    llms.text.length > 0 &&
    !/^\s*<!doctype html/i.test(llms.text) &&
    !/^\s*<html/i.test(llms.text);

  let sitemapFound = Boolean(
    sitemap &&
      sitemap.ok &&
      (sitemap.text.includes("<urlset") ||
        sitemap.text.includes("<sitemapindex") ||
        sitemap.text.includes("<url"))
  );
  let sitemapUrl: string | null = sitemapFound ? defaultSitemap : null;

  // Try sitemap hint from robots.txt
  if (robotsOk && robots?.text) {
    const match = robots.text.match(/^\s*Sitemap:\s*(\S+)/im);
    if (match?.[1]) {
      sitemapUrl = match[1].trim();
      if (!sitemapFound) {
        const alt = await fetchText(sitemapUrl, {
          accept: "application/xml,text/xml,text/plain,*/*",
          timeoutMs: AUX_FETCH_TIMEOUT_MS,
        }).catch(() => null);
        sitemapFound = Boolean(
          alt &&
            alt.ok &&
            (alt.text.includes("<urlset") ||
              alt.text.includes("<sitemapindex") ||
              alt.text.includes("<url"))
        );
        if (!sitemapFound) sitemapUrl = null;
      }
    }
  }

  return {
    url: url.toString(),
    finalUrl: page.finalUrl,
    statusCode: page.status,
    html: page.text,
    loadTimeMs: page.ms,
    robotsTxt: robotsOk ? robots!.text : null,
    robotsTxtUrl: robotsOk ? robotsUrl : null,
    sitemapFound,
    sitemapUrl,
    llmsTxtFound: Boolean(llmsOk),
    llmsTxtUrl: llmsOk ? llmsUrl : null,
    responseHeaders: page.headers,
    redirected: page.redirected,
    fetchSource,
  };
}
