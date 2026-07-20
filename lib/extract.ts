import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import type { FetchedPage } from "./fetch-page";
import type { PageSignals } from "./types";

const AI_BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"];

function absUrl(base: string, href: string | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function collectJsonLdTypes(data: unknown, out: Set<string>) {
  if (!data || typeof data !== "object") return;
  if (Array.isArray(data)) {
    for (const item of data) collectJsonLdTypes(item, out);
    return;
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj["@type"] === "string") out.add(obj["@type"]);
  if (Array.isArray(obj["@type"])) {
    for (const t of obj["@type"]) if (typeof t === "string") out.add(t);
  }
  if (obj["@graph"]) collectJsonLdTypes(obj["@graph"], out);
}

function textContent($: cheerio.CheerioAPI, el: unknown): string {
  return $(el as never).text().replace(/\s+/g, " ").trim();
}

export function extractSignals(page: FetchedPage): PageSignals {
  const $ = cheerio.load(page.html);
  const base = page.finalUrl;
  let host = "";
  try {
    host = new URL(base).hostname;
  } catch {
    host = "";
  }

  // Remove non-content noise for word count / body
  $("script, style, noscript, svg, iframe").remove();

  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";

  const canonical =
    absUrl(base, $('link[rel="canonical"]').attr("href")) ||
    $('link[rel="canonical"]').attr("href") ||
    null;

  const viewport = $('meta[name="viewport"]').attr("content")?.trim() || null;
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() || null;
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;
  const ogDescription =
    $('meta[property="og:description"]').attr("content")?.trim() || null;
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim() || null;

  const h1 = $("h1")
    .map((_, el) => textContent($, el))
    .get()
    .filter(Boolean);
  const h2 = $("h2")
    .map((_, el) => textContent($, el))
    .get()
    .filter(Boolean);
  const h3 = $("h3")
    .map((_, el) => textContent($, el))
    .get()
    .filter(Boolean);

  const headings: { level: number; text: string }[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = $(el).prop("tagName")?.toString().toLowerCase() || "";
    const level = Number(tag.replace("h", "")) || 0;
    const text = textContent($, el);
    if (level && text) headings.push({ level, text });
  });

  const images = $("img")
    .map((_, el) => ({
      src: $(el).attr("src") || "",
      alt: $(el).attr("alt") ?? null,
    }))
    .get()
    .filter((img) => img.src);

  const links: PageSignals["links"] = [];
  $("a[href]").each((_, el) => {
    const hrefRaw = $(el).attr("href") || "";
    if (
      !hrefRaw ||
      hrefRaw.startsWith("#") ||
      hrefRaw.startsWith("mailto:") ||
      hrefRaw.startsWith("tel:") ||
      hrefRaw.startsWith("javascript:")
    ) {
      return;
    }
    const absolute = absUrl(base, hrefRaw);
    if (!absolute) return;
    let internal = false;
    try {
      internal = new URL(absolute).hostname === host;
    } catch {
      internal = false;
    }
    links.push({
      href: absolute,
      text: textContent($, el),
      internal,
    });
  });

  const jsonLdRaw: unknown[] = [];
  const typeSet = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw?.trim()) return;
    try {
      const parsed = JSON.parse(raw);
      jsonLdRaw.push(parsed);
      collectJsonLdTypes(parsed, typeSet);
    } catch {
      // ignore invalid JSON-LD
    }
  });
  const jsonLdTypes = Array.from(typeSet);

  const hasFaqSchema = jsonLdTypes.some((t) => /faq/i.test(t));
  const hasHowToSchema = jsonLdTypes.some((t) => /howto/i.test(t));
  const hasQaSchema = jsonLdTypes.some((t) => /qapage|question|answer/i.test(t));

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

  const firstParagraph =
    $("main p, article p, p")
      .filter((_, el) => textContent($, el).length > 40)
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim() || "";

  const hasMain = $("main").length > 0;
  const hasArticle = $("article").length > 0;
  const hasHeader = $("header").length > 0;

  const authorMeta =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    $('[rel="author"]').text() ||
    $('[itemprop="author"]').text() ||
    "";
  const hasAuthor =
    Boolean(authorMeta.trim()) ||
    jsonLdTypes.some((t) => /person|author/i.test(t)) ||
    /by\s+[A-Z]/i.test(bodyText.slice(0, 2000));

  let hasDate = false;
  let dateDetail: string | null = null;
  const timeEl = $("time[datetime]").first().attr("datetime");
  const articlePublished =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $('meta[property="og:updated_time"]').attr("content");
  if (timeEl) {
    hasDate = true;
    dateDetail = timeEl;
  } else if (articlePublished) {
    hasDate = true;
    dateDetail = articlePublished;
  } else if (jsonLdRaw.length) {
    const blob = JSON.stringify(jsonLdRaw);
    const m = blob.match(
      /"(datePublished|dateModified|uploadDate)"\s*:\s*"([^"]+)"/i
    );
    if (m) {
      hasDate = true;
      dateDetail = m[2];
    }
  }

  // body HTML for seord (prefer main/article)
  const bodyHtml =
    $("main").html() ||
    $("article").html() ||
    $("body").html() ||
    page.html;

  // robots AI bots
  let aiBots: PageSignals["aiBots"] = AI_BOTS.map((name) => ({
    name,
    allowed: null,
  }));

  if (page.robotsTxt) {
    try {
      const robots = robotsParser(page.robotsTxtUrl || `${new URL(base).origin}/robots.txt`, page.robotsTxt);
      aiBots = AI_BOTS.map((name) => ({
        name,
        allowed: robots.isAllowed(base, name) ?? null,
      }));
    } catch {
      // keep nulls
    }
  }

  let https = false;
  try {
    https = new URL(base).protocol === "https:";
  } catch {
    https = false;
  }

  return {
    url: page.url,
    finalUrl: page.finalUrl,
    statusCode: page.statusCode,
    https,
    title,
    metaDescription,
    canonical,
    viewport,
    robotsMeta,
    ogTitle,
    ogDescription,
    ogImage,
    h1,
    h2,
    h3,
    headings,
    images,
    links,
    jsonLdTypes,
    jsonLdRaw,
    hasFaqSchema,
    hasHowToSchema,
    hasQaSchema,
    wordCount,
    firstParagraph,
    hasMain,
    hasArticle,
    hasHeader,
    hasAuthor,
    hasDate,
    dateDetail,
    html: page.html,
    bodyHtml: bodyHtml || "",
    robotsTxt: page.robotsTxt,
    robotsTxtUrl: page.robotsTxtUrl,
    sitemapFound: page.sitemapFound,
    sitemapUrl: page.sitemapUrl,
    llmsTxtFound: page.llmsTxtFound,
    llmsTxtUrl: page.llmsTxtUrl,
    aiBots,
    loadTimeMs: page.loadTimeMs,
  };
}
