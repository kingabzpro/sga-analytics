const USER_AGENT =
  "SGA-Analytics/0.1 (+https://github.com/kingabzpro/sga-analytics; website auditor)";

const FETCH_TIMEOUT_MS = 12000;
const MAX_HTML_BYTES = 2_000_000;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

function isPrivateIp(hostname: string): boolean {
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

async function fetchText(
  url: string,
  options?: { accept?: string }
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string; ms: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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

    return {
      ok: res.ok,
      status: res.status,
      text,
      finalUrl: res.url || url,
      ms: Date.now() - start,
    };
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
};

export async function fetchPageBundle(inputUrl: string): Promise<FetchedPage> {
  const url = normalizeUrl(inputUrl);
  const origin = url.origin;

  const page = await fetchText(url.toString());
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
    fetchText(robotsUrl, { accept: "text/plain,*/*" }).catch(() => null),
    fetchText(llmsUrl, { accept: "text/plain,*/*" }).catch(() => null),
    fetchText(defaultSitemap, {
      accept: "application/xml,text/xml,text/plain,*/*",
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
  };
}
