import type { BrokenLink, CategoryScore, CheckResult, PageSignals } from "./types";
import { buildCategory, clamp01, ramp } from "./score-utils";

/**
 * Technical / best-practices health — the 5th scored category (phase 4).
 *
 * Evaluated from a single page fetch plus a bounded HEAD probe of outbound
 * links (see lib/check-links.ts). All checks degrade gracefully: with no
 * outbound links the broken-link check earns full credit, and missing headers
 * just lower partial credit rather than failing the whole category.
 */
export function scoreTechnical(opts: {
  signals: PageSignals;
  brokenLinks: BrokenLink[];
}): CategoryScore {
  const { signals, brokenLinks } = opts;
  const checks: CheckResult[] = [];
  const h = signals.responseHeaders || {};

  // --- Security headers (weight 28) ---
  const wanted: { key: string; label: string }[] = [
    { key: "strict-transport-security", label: "HSTS" },
    { key: "x-content-type-options", label: "X-Content-Type-Options" },
    { key: "content-security-policy", label: "CSP" },
    { key: "referrer-policy", label: "Referrer-Policy" },
    { key: "permissions-policy", label: "Permissions-Policy" },
  ];
  const present = wanted.filter((w) => h[w.key]);
  const missing = wanted.filter((w) => !h[w.key]);
  checks.push({
    id: "security-headers",
    label: "Security response headers",
    passed: present.length >= 3,
    partialScore: clamp01(ramp(present.length, [0, 5])),
    weight: 28,
    detail:
      present.length > 0
        ? `Present: ${present.map((p) => p.label).join(", ")}${
            missing.length ? ` · Missing: ${missing.map((m) => m.label).join(", ")}` : ""
          }`
        : "No security headers (HSTS, CSP, etc.) detected",
  });

  // --- HTTPS enforced (weight 14) ---
  // Pass if on HTTPS. If the request was redirected, that usually means an
  // http->https upgrade happened (good); a non-https origin without it is weak.
  checks.push({
    id: "https-enforced",
    label: "HTTPS enforced",
    passed: signals.https,
    partialScore: signals.https ? 1 : 0,
    weight: 14,
    detail: signals.https
      ? signals.redirected
        ? "Served over HTTPS (request was redirected — likely an http→https upgrade)"
        : "Served over HTTPS"
      : "Not served over HTTPS",
  });

  // --- Redirect chain (weight 12) ---
  // `redirected` true means at least one hop occurred. We can't count hops from
  // the fetch API, so treat any redirect as a minor penalty (chain present).
  checks.push({
    id: "redirect-chain",
    label: "Redirect chain",
    passed: !signals.redirected,
    partialScore: signals.redirected ? 0.6 : 1,
    weight: 12,
    detail: signals.redirected
      ? `Requested URL redirected to ${signals.finalUrl}`
      : "No redirect — served directly at the requested URL",
  });

  // --- Image dimensions (weight 18) ---
  const totalImages = signals.imagesWithDimensions + signals.imagesMissingDimensions;
  const dimRatio = totalImages > 0 ? signals.imagesWithDimensions / totalImages : 1;
  checks.push({
    id: "image-dimensions",
    label: "Image dimensions",
    passed: totalImages === 0 || dimRatio >= 0.8,
    partialScore: clamp01(dimRatio),
    weight: 18,
    detail:
      totalImages === 0
        ? "No images to evaluate"
        : `${signals.imagesWithDimensions} of ${totalImages} images have width/height (missing dimensions cause layout shift)`,
  });

  // --- Broken outbound links (weight 28) ---
  const broken = brokenLinks.filter((l) => !l.ok);
  const ratioOk =
    brokenLinks.length > 0 ? (brokenLinks.length - broken.length) / brokenLinks.length : 1;
  checks.push({
    id: "broken-links",
    label: "Broken outbound links",
    passed: broken.length === 0,
    partialScore: clamp01(ratioOk),
    weight: 28,
    detail:
      brokenLinks.length === 0
        ? "No outbound links checked"
        : broken.length === 0
          ? `All ${brokenLinks.length} checked outbound link(s) are reachable`
          : `${broken.length} of ${brokenLinks.length} outbound link(s) broken: ${broken
              .slice(0, 3)
              .map((b) => `${b.url} (${b.status ?? "error"})`)
              .join(", ")}`,
  });

  return buildCategory(checks, (c) => {
    switch (c.id) {
      case "security-headers":
        return "Add security response headers (HSTS, Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) via your server/CDN.";
      case "https-enforced":
        return "Force HTTPS with a 301 redirect from http to https and enable HSTS.";
      case "redirect-chain":
        return "Avoid redirect chains — point internal links directly at the final canonical URL.";
      case "image-dimensions":
        return "Set explicit width and height attributes on every <img> to prevent Cumulative Layout Shift.";
      case "broken-links":
        return "Fix or remove broken outbound links (404s/timeouts) — they hurt UX and crawl efficiency.";
      default:
        return `Improve: ${c.label}`;
    }
  });
}
