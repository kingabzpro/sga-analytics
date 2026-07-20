import type { CategoryScore, CheckResult, PageSignals } from "./types";
import { buildCategory } from "./score-utils";

export function scoreGeo(signals: PageSignals): CategoryScore {
  const checks: CheckResult[] = [];

  const usefulSchema = signals.jsonLdTypes.filter((t) =>
    /organization|website|webpage|article|blogposting|product|person|breadcrumb/i.test(
      t
    )
  );
  checks.push({
    id: "json-ld",
    label: "Structured data (JSON-LD)",
    passed: usefulSchema.length >= 1,
    weight: 16,
    detail:
      signals.jsonLdTypes.length > 0
        ? `Types: ${signals.jsonLdTypes.slice(0, 8).join(", ")}`
        : "No JSON-LD structured data found",
  });

  checks.push({
    id: "llms-txt",
    label: "llms.txt for AI crawlers",
    passed: signals.llmsTxtFound,
    weight: 10,
    detail: signals.llmsTxtFound
      ? `Found at ${signals.llmsTxtUrl}`
      : "No /llms.txt at site root",
  });

  const knownBots = signals.aiBots.filter((b) => b.allowed !== null);
  const allowedBots = knownBots.filter((b) => b.allowed === true);
  const blockedBots = knownBots.filter((b) => b.allowed === false);
  // Pass if robots.txt exists and not all AI bots are blocked
  const aiAccessOk =
    !signals.robotsTxt
      ? false
      : blockedBots.length === 0 || allowedBots.length > 0;

  checks.push({
    id: "ai-bot-access",
    label: "AI bot crawl access",
    passed: aiAccessOk && blockedBots.length < signals.aiBots.length,
    weight: 14,
    detail: !signals.robotsTxt
      ? "No robots.txt to evaluate AI bot policy"
      : blockedBots.length === 0
        ? `AI bots appear allowed (${allowedBots.map((b) => b.name).join(", ") || "default allow"})`
        : `Blocked: ${blockedBots.map((b) => b.name).join(", ")}; Allowed: ${
            allowedBots.map((b) => b.name).join(", ") || "none explicit"
          }`,
  });

  const externalLinks = signals.links.filter((l) => !l.internal);
  checks.push({
    id: "citations",
    label: "Outbound citation links",
    passed: externalLinks.length >= 2,
    weight: 12,
    detail: `${externalLinks.length} external link(s) (citations help generative engines)`,
  });

  checks.push({
    id: "freshness",
    label: "Date / freshness signal",
    passed: signals.hasDate,
    weight: 10,
    detail: signals.hasDate
      ? `Date signal: ${signals.dateDetail}`
      : "No publish/modified date detected",
  });

  const trustPaths = signals.links.filter((l) =>
    /about|contact|privacy|team|author|trust/i.test(l.href + " " + l.text)
  );
  checks.push({
    id: "eeat-pages",
    label: "E-E-A-T related links",
    passed: trustPaths.length >= 1 || signals.hasAuthor,
    weight: 12,
    detail:
      trustPaths.length > 0
        ? `Found ${trustPaths.length} about/contact/trust-style link(s)`
        : signals.hasAuthor
          ? "Author present but weak about/contact links"
          : "No about/contact/author trust links found",
  });

  checks.push({
    id: "semantic-landmarks",
    label: "Semantic HTML landmarks",
    passed: signals.hasMain || signals.hasArticle || signals.hasHeader,
    weight: 8,
    detail: [
      signals.hasHeader ? "header" : null,
      signals.hasMain ? "main" : null,
      signals.hasArticle ? "article" : null,
    ]
      .filter(Boolean)
      .join(", ") || "No header/main/article landmarks",
  });

  checks.push({
    id: "https-geo",
    label: "Secure origin (HTTPS)",
    passed: signals.https,
    weight: 8,
    detail: signals.https ? "HTTPS enabled" : "Not on HTTPS",
  });

  checks.push({
    id: "clear-title-entity",
    label: "Clear title entity",
    passed: signals.title.length >= 10,
    weight: 10,
    detail: signals.title
      ? `Title: “${signals.title.slice(0, 90)}”`
      : "Missing title, so entities are harder to extract",
  });

  return buildCategory(checks, (c) => {
    switch (c.id) {
      case "json-ld":
        return "Add JSON-LD for Organization, WebSite, and Article/BlogPosting where relevant.";
      case "llms-txt":
        return "Add an /llms.txt file describing your site for AI crawlers and answer engines.";
      case "ai-bot-access":
        return "Review robots.txt so trusted AI crawlers you want citations from are not blocked unintentionally.";
      case "citations":
        return "Cite authoritative external sources with outbound links to improve trust for generative engines.";
      case "freshness":
        return "Expose publish/updated dates (time[datetime] or Article datePublished).";
      case "eeat-pages":
        return "Link to About, Contact, and author pages to strengthen E-E-A-T signals.";
      case "semantic-landmarks":
        return "Use semantic landmarks (<header>, <main>, <article>) for cleaner AI extraction.";
      case "https-geo":
        return "Migrate fully to HTTPS.";
      case "clear-title-entity":
        return "Use a descriptive title that names the primary entity/topic of the page.";
      default:
        return `Improve: ${c.label}`;
    }
  });
}
