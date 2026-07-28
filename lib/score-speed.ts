import type { CategoryScore, CheckResult, PageSignals } from "./types";
import { buildCategory, clamp01, ramp, rampDown } from "./score-utils";

const KB = 1024;

/** Count render-blocking <script> tags in <head> (no async/defer, no type=application/json). */
function countBlockingScripts(html: string): number {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html;
  const scripts = head.match(/<script\b[^>]*>/gi) || [];
  return scripts.filter((tag) => {
    if (/\btype\s*=\s*["']?application\/(?:ld\+)?json["']?/i.test(tag)) return false;
    if (/\b(?:src|data-src)\s*=/i.test(tag) === false) return false; // inline runs sync but no fetch
    return !/\b(?:async|defer)\b/i.test(tag);
  }).length;
}

function countStylesheets(html: string): number {
  return (html.match(/<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*>/gi) || []).length;
}

export function scoreSpeed(signals: PageSignals): CategoryScore {
  const checks: CheckResult[] = [];
  const htmlBytes = signals.html.length;
  const htmlKb = Math.round((htmlBytes / KB) * 10) / 10;

  checks.push({
    id: "response-time",
    label: "Server response time",
    // full credit under 800ms, linearly down to 0 at 2500ms
    passed: signals.loadTimeMs < 1500,
    partialScore: clamp01(rampDown(signals.loadTimeMs, 800, 2500)),
    weight: 22,
    detail:
      signals.loadTimeMs < 800
        ? `Fast response (${signals.loadTimeMs} ms)`
        : signals.loadTimeMs < 1500
          ? `Acceptable response (${signals.loadTimeMs} ms)`
          : `Slow response (${signals.loadTimeMs} ms)`,
  });

  checks.push({
    id: "page-weight",
    label: "Page weight (HTML)",
    // full credit under 200KB, ramps down to 0 at ~1.5MB
    passed: htmlBytes < 500 * KB,
    partialScore: clamp01(rampDown(htmlBytes, 200 * KB, 1500 * KB)),
    weight: 16,
    detail:
      htmlBytes < 200 * KB
        ? `Lightweight HTML (${htmlKb} KB)`
        : htmlBytes < 500 * KB
          ? `Moderate HTML weight (${htmlKb} KB)`
          : `Heavy HTML (${htmlKb} KB)`,
  });

  const blockingScripts = countBlockingScripts(signals.html);
  checks.push({
    id: "render-blocking-scripts",
    label: "Render-blocking scripts",
    // full at 0, half at 3, 0 at ~6
    passed: blockingScripts <= 2,
    partialScore: clamp01(rampDown(blockingScripts, 0, 6)),
    weight: 14,
    detail:
      blockingScripts === 0
        ? "No render-blocking <script> tags in <head>"
        : `${blockingScripts} render-blocking <script> in <head>`,
  });

  const stylesheets = countStylesheets(signals.html);
  checks.push({
    id: "stylesheets",
    label: "Stylesheet requests",
    passed: stylesheets <= 3,
    weight: 8,
    detail:
      stylesheets <= 2
        ? `${stylesheets} stylesheet(s)`
        : `${stylesheets} stylesheets (consider bundling)`,
  });

  const imageCount = signals.images.length;
  checks.push({
    id: "image-requests",
    label: "Image request volume",
    // full at <=20, ramps down to 0 at ~60
    passed: imageCount <= 20,
    partialScore:
      imageCount <= 20 ? 1 : clamp01(rampDown(imageCount, 20, 60)),
    weight: 12,
    detail:
      imageCount === 0
        ? "No images on the page"
        : imageCount <= 20
          ? `${imageCount} image(s) to load`
          : `${imageCount} images (lazy-load and compress below the fold)`,
  });

  const efficiency = htmlBytes > 0 ? signals.wordCount / htmlBytes : 0;
  checks.push({
    id: "html-efficiency",
    label: "HTML efficiency (text ratio)",
    // continuous: 0 at 0%, full at ~15% ratio
    passed: efficiency >= 0.08,
    partialScore: clamp01(ramp(efficiency, [0, 0.15])),
    weight: 10,
    detail: `Text-to-HTML ratio ${(efficiency * 100).toFixed(1)}%`,
  });

  checks.push({
    id: "mobile-viewport",
    label: "Mobile viewport meta",
    passed: Boolean(signals.viewport),
    weight: 10,
    detail: signals.viewport
      ? `viewport: ${signals.viewport.slice(0, 80)}`
      : "Missing <meta name=\"viewport\">",
  });

  checks.push({
    id: "https-speed",
    label: "Modern protocol (HTTPS)",
    passed: signals.https,
    weight: 8,
    detail: signals.https
      ? "HTTPS enabled (HTTP/2+ available)"
      : "Not on HTTPS — older protocol and ranking penalty",
  });

  return buildCategory(checks, (c) => {
    switch (c.id) {
      case "response-time":
        return "Improve server response (TTFB): caching, CDN, or faster origin hosting to get under ~800 ms.";
      case "page-weight":
        return "Reduce HTML weight: minify markup, trim inline SVG, and split large server-rendered pages.";
      case "render-blocking-scripts":
        return "Move render-blocking <script> tags to the end of <body> or add async/defer.";
      case "stylesheets":
        return "Bundle and inline critical CSS; load non-critical stylesheets asynchronously.";
      case "image-requests":
        return "Compress images, use modern formats (WebP/AVIF), and lazy-load images below the fold.";
      case "html-efficiency":
        return "Tighten markup: remove unused wrappers and inline scripts/styles to raise text-to-HTML ratio.";
      case "mobile-viewport":
        return "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> for mobile rendering.";
      case "https-speed":
        return "Serve the site over HTTPS with a valid certificate to enable HTTP/2+ and faster connections.";
      default:
        return `Improve: ${c.label}`;
    }
  });
}
