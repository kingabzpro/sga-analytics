import type { CategoryScore, CheckResult, PageSignals, PsiMetrics } from "./types";
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

/** Format a millisecond value as a compact human string: 1200 -> "1.2s", 320 -> "320ms". */
function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s` : `${Math.round(ms)}ms`;
}

export function scoreSpeed(
  signals: PageSignals,
  psi: PsiMetrics | null = null
): CategoryScore {
  const checks = psi ? cwvSpeedChecks(psi) : heuristicSpeedChecks(signals);

  return buildCategory(checks, (c) => {
    switch (c.id) {
      // CWV-led checks
      case "cwv-lcp":
        return "Improve Largest Contentful Paint: preload the hero image/font, reduce server response time, and avoid render-blocking resources (LCP under 2.5s).";
      case "cwv-inp":
        return "Improve Interaction to Next Paint: break up long JavaScript tasks, defer non-critical scripts, and yield to the main thread (INP under 200ms).";
      case "cwv-cls":
        return "Reduce Cumulative Layout Shift: reserve space for images/ads/embeds, avoid injecting content above existing elements, and set width/height on media (CLS under 0.1).";
      case "cwv-fcp":
        return "Improve First Contentful Paint: inline critical CSS, remove render-blocking scripts, and use a CDN so the first paint happens fast.";
      case "cwv-tbt":
        return "Reduce Total Blocking Time: code-split JavaScript, lazy-load below-the-fold code, and trim third-party scripts that hog the main thread.";
      case "cwv-ttfb":
        return "Improve Time to First Byte: enable caching/CDN, use efficient origin hosting, and avoid expensive server-side work on every request (under ~800ms).";
      case "cwv-perf":
        return "Raise the Lighthouse performance score: prioritize the slowest Core Web Vital first — it usually lifts the overall score the most.";
      // Heuristic-led checks (used when no PSI key is set)
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

/**
 * Real Core Web Vitals check set, used when PSI returns usable data. Prefers
 * field (CrUX p75) values over lab (Lighthouse) per metric and labels the
 * source in each check's detail. Weights sum to 100; `scoreFromChecks`
 * normalizes by total weight so this is independent of the heuristic table.
 */
function cwvSpeedChecks(psi: PsiMetrics): CheckResult[] {
  const checks: CheckResult[] = [];
  const field = psi.field;
  const lab = psi.lab;

  // --- LCP (weight 26) — field p75 preferred, lab fallback ---
  const lcpMs = field?.lcpMs ?? lab?.lcpMs ?? null;
  const lcpSource = field?.lcpMs != null ? "field p75 (CrUX)" : "Lighthouse lab";
  if (lcpMs !== null) {
    checks.push({
      id: "cwv-lcp",
      label: "Largest Contentful Paint",
      passed: lcpMs < 4000, // good <2500, poor >4000
      partialScore: clamp01(rampDown(lcpMs, 2500, 4000)),
      weight: 26,
      detail: `LCP ${fmtMs(lcpMs)} · ${lcpSource}`,
    });
  }

  // --- INP (weight 20) — field p75 preferred; lab TBT is the closest proxy ---
  if (field?.inpMs != null) {
    const inpMs = field.inpMs;
    checks.push({
      id: "cwv-inp",
      label: "Interaction to Next Paint",
      passed: inpMs < 500, // good <200, poor >500
      partialScore: clamp01(rampDown(inpMs, 200, 500)),
      weight: 20,
      detail: `INP ${fmtMs(inpMs)} · field p75 (CrUX)`,
    });
  } else if (lab?.tbtMs != null) {
    // No field INP — approximate interactivity with lab Total Blocking Time.
    const tbtMs = lab.tbtMs;
    checks.push({
      id: "cwv-inp",
      label: "Interaction to Next Paint",
      passed: tbtMs < 600, // good TBT <200ms, poor >600ms
      partialScore: clamp01(rampDown(tbtMs, 200, 600)),
      weight: 20,
      detail: `~INP via TBT ${fmtMs(tbtMs)} · Lighthouse lab (no field data)`,
    });
  }

  // --- CLS (weight 18) — field p75 preferred, lab fallback ---
  const cls = field?.cls ?? lab?.cls ?? null;
  const clsSource = field?.cls != null ? "field p75 (CrUX)" : "Lighthouse lab";
  if (cls !== null) {
    checks.push({
      id: "cwv-cls",
      label: "Cumulative Layout Shift",
      passed: cls < 0.25, // good <0.1, poor >0.25
      partialScore: clamp01(rampDown(cls, 0.1, 0.25)),
      weight: 18,
      detail: `CLS ${cls.toFixed(3)} · ${clsSource}`,
    });
  }

  // --- FCP (weight 12) — lab (field FCP is less actionable) ---
  if (lab?.fcpMs != null) {
    const fcpMs = lab.fcpMs;
    checks.push({
      id: "cwv-fcp",
      label: "First Contentful Paint",
      passed: fcpMs < 3000, // good <1800, poor >3000
      partialScore: clamp01(rampDown(fcpMs, 1800, 3000)),
      weight: 12,
      detail: `FCP ${fmtMs(fcpMs)} · Lighthouse lab`,
    });
  }

  // --- TBT (weight 10) — lab only (no field equivalent) ---
  if (lab?.tbtMs != null) {
    const tbtMs = lab.tbtMs;
    checks.push({
      id: "cwv-tbt",
      label: "Total Blocking Time",
      passed: tbtMs < 600,
      partialScore: clamp01(rampDown(tbtMs, 200, 600)),
      weight: 10,
      detail: `TBT ${fmtMs(tbtMs)} · Lighthouse lab`,
    });
  }

  // --- TTFB (weight 8) — lab server-response-time ---
  if (lab?.ttfbMs != null) {
    const ttfbMs = lab.ttfbMs;
    checks.push({
      id: "cwv-ttfb",
      label: "Time to First Byte",
      passed: ttfbMs < 1800, // good <800, poor >1800
      partialScore: clamp01(rampDown(ttfbMs, 800, 1800)),
      weight: 8,
      detail: `TTFB ${fmtMs(ttfbMs)} · Lighthouse lab`,
    });
  }

  // --- Lighthouse performance score (weight 6) — overall lab composite ---
  if (lab?.performanceScore != null) {
    const perf = lab.performanceScore;
    checks.push({
      id: "cwv-perf",
      label: "Lighthouse performance",
      passed: perf >= 50,
      partialScore: clamp01(ramp(perf, [0, 100])),
      weight: 6,
      detail: `Performance ${perf}/100 · Lighthouse lab`,
    });
  }

  // Defensive guard: if parsing somehow produced nothing usable, the caller
  // (analyze.ts) only invokes this branch when `psi` is non-null, and psi.ts
  // guarantees lab is present, so this should never be empty. Returning an
  // empty array yields a 0 score via scoreFromChecks rather than throwing.
  return checks;
}

/**
 * On-page heuristic check set — used when no PSI key is set or the call fails.
 * Pure static-HTML inference (page weight, render-blocking scripts, etc.) plus
 * the single wall-clock fetch time. Unchanged from phase 1.
 */
function heuristicSpeedChecks(signals: PageSignals): CheckResult[] {
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

  return checks;
}
