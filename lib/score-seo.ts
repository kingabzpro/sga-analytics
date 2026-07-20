import { analyzeSeo } from "seord";
import type { CategoryScore, CheckResult, PageSignals } from "./types";
import { buildCategory, clamp } from "./score-utils";

function pickKeyword(signals: PageSignals): string {
  const fromH1 = signals.h1[0] || "";
  const fromTitle = signals.title || "";
  const source = fromH1 || fromTitle;
  const words = source
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  if (words.length === 0) return "website";
  // Prefer 1-3 meaningful words
  return words.slice(0, Math.min(3, words.length)).join(" ");
}

export function scoreSeo(signals: PageSignals): CategoryScore {
  const checks: CheckResult[] = [];

  const titleLen = signals.title.length;
  checks.push({
    id: "title",
    label: "Title tag",
    passed: titleLen >= 10 && titleLen <= 65,
    weight: 12,
    detail: titleLen
      ? `Title is ${titleLen} characters`
      : "Missing <title> tag",
  });

  const metaLen = signals.metaDescription.length;
  checks.push({
    id: "meta-description",
    label: "Meta description",
    passed: metaLen >= 70 && metaLen <= 170,
    weight: 12,
    detail: metaLen
      ? `Meta description is ${metaLen} characters`
      : "Missing meta description",
  });

  checks.push({
    id: "h1-single",
    label: "Single H1 heading",
    passed: signals.h1.length === 1,
    weight: 10,
    detail:
      signals.h1.length === 0
        ? "No H1 found"
        : signals.h1.length === 1
          ? `H1: “${signals.h1[0].slice(0, 80)}”`
          : `Found ${signals.h1.length} H1 tags (prefer exactly one)`,
  });

  checks.push({
    id: "https",
    label: "HTTPS",
    passed: signals.https,
    weight: 10,
    detail: signals.https ? "Page served over HTTPS" : "Page is not using HTTPS",
  });

  checks.push({
    id: "viewport",
    label: "Mobile viewport meta",
    passed: Boolean(signals.viewport),
    weight: 8,
    detail: signals.viewport
      ? `viewport: ${signals.viewport.slice(0, 80)}`
      : "Missing <meta name=\"viewport\">",
  });

  checks.push({
    id: "canonical",
    label: "Canonical URL",
    passed: Boolean(signals.canonical),
    weight: 6,
    detail: signals.canonical || "No canonical link tag",
  });

  const hasOg = Boolean(signals.ogTitle || signals.ogDescription);
  checks.push({
    id: "open-graph",
    label: "Open Graph tags",
    passed: hasOg,
    weight: 6,
    detail: hasOg
      ? "Open Graph title/description present"
      : "Missing Open Graph tags",
  });

  const imgs = signals.images;
  const withAlt = imgs.filter((i) => i.alt !== null && i.alt.trim() !== "").length;
  const altRatio = imgs.length === 0 ? 1 : withAlt / imgs.length;
  checks.push({
    id: "img-alt",
    label: "Image alt text coverage",
    passed: imgs.length === 0 || altRatio >= 0.7,
    weight: 8,
    detail:
      imgs.length === 0
        ? "No images found"
        : `${withAlt}/${imgs.length} images have alt text (${Math.round(altRatio * 100)}%)`,
  });

  checks.push({
    id: "robots-txt",
    label: "robots.txt present",
    passed: Boolean(signals.robotsTxt),
    weight: 6,
    detail: signals.robotsTxt
      ? `Found at ${signals.robotsTxtUrl}`
      : "No robots.txt at site root",
  });

  checks.push({
    id: "sitemap",
    label: "XML sitemap",
    passed: signals.sitemapFound,
    weight: 6,
    detail: signals.sitemapFound
      ? `Sitemap found${signals.sitemapUrl ? ` at ${signals.sitemapUrl}` : ""}`
      : "No sitemap.xml detected",
  });

  checks.push({
    id: "content-length",
    label: "Sufficient content",
    passed: signals.wordCount >= 200,
    weight: 6,
    detail: `${signals.wordCount} words on page`,
  });

  // seord content SEO score
  let seordScore = 50;
  let seordDetail = "Skipped (insufficient HTML)";
  try {
    const keyword = pickKeyword(signals);
    const result = analyzeSeo(
      {
        title: signals.title || "Untitled",
        htmlText: signals.bodyHtml || `<p>${signals.firstParagraph || "content"}</p>`,
        keyword,
        subKeywords: keyword.split(" ").filter((w) => w.length > 3).slice(1),
        metaDescription: signals.metaDescription || signals.title || "Description",
      },
      {
        siteDomainName: (() => {
          try {
            return new URL(signals.finalUrl).hostname;
          } catch {
            return "example.com";
          }
        })(),
      }
    );
    seordScore = clamp(Math.round(result.seoScore ?? 0));
    seordDetail = `seord content SEO score ${seordScore}/100 (keyword “${keyword}”)`;
  } catch (err) {
    seordDetail = `seord analysis failed: ${err instanceof Error ? err.message : "unknown error"}`;
    seordScore = 40;
  }

  checks.push({
    id: "seord-content",
    label: "Content SEO (seord)",
    passed: seordScore >= 60,
    weight: 10,
    detail: seordDetail,
  });

  // Blend seord into score slightly by treating partial credit
  // (passed is binary; we also fold seord into final via weight pass threshold)
  // If seord is mid-range, still count partial via adjusting a synthetic check
  if (seordScore >= 40 && seordScore < 60) {
    // replace last check with half-weight pass illusion: add partial by boosting score later
  }

  const category = buildCategory(checks, (c) => {
    switch (c.id) {
      case "title":
        return "Add a clear title tag between about 30-60 characters that describes the page.";
      case "meta-description":
        return "Write a compelling meta description (about 120-160 characters) summarizing the page.";
      case "h1-single":
        return "Use exactly one H1 that matches the main topic of the page.";
      case "https":
        return "Serve the site over HTTPS with a valid certificate.";
      case "viewport":
        return "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.";
      case "canonical":
        return "Add a rel=canonical link to the preferred URL of this page.";
      case "open-graph":
        return "Add Open Graph tags (og:title, og:description, og:image) for social sharing.";
      case "img-alt":
        return "Add descriptive alt text to images that convey meaning.";
      case "robots-txt":
        return "Publish a robots.txt at the site root to guide crawlers.";
      case "sitemap":
        return "Publish an XML sitemap and reference it in robots.txt.";
      case "content-length":
        return "Expand page content to at least ~200 words of useful, unique copy.";
      case "seord-content":
        return "Improve on-page content SEO: keyword in title/H1, natural density, and internal links.";
      default:
        return `Improve: ${c.label}`;
    }
  });

  // Soft-blend seord continuous score into category score
  const blended = Math.round(category.score * 0.85 + seordScore * 0.15);
  return { ...category, score: clamp(blended) };
}
