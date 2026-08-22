import "server-only";

import type { AnalyzeResult, CategoryScore } from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? escapeHtml(url.toString())
      : "#";
  } catch {
    return "#";
  }
}

function scoreTone(score: number): string {
  if (score >= 80) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "warn";
  return "poor";
}

function categoryHtml(label: string, category: CategoryScore): string {
  const checks = category.checks
    .map(
      (check) => `
        <tr>
          <td><span class="status ${check.passed ? "pass" : "fail"}">${check.passed ? "PASS" : "FIX"}</span></td>
          <td><strong>${escapeHtml(check.label)}</strong><br><span class="muted">${escapeHtml(check.detail)}</span></td>
          <td class="num">${Math.round((check.partialScore ?? (check.passed ? 1 : 0)) * 100)}%</td>
        </tr>`
    )
    .join("");

  return `
    <section class="panel category">
      <div class="section-head">
        <h2>${escapeHtml(label)}</h2>
        <span class="score ${scoreTone(category.score)}">${category.score}</span>
      </div>
      <table><thead><tr><th>Status</th><th>Check</th><th>Credit</th></tr></thead><tbody>${checks}</tbody></table>
    </section>`;
}

export function sharedReportFilename(result: AnalyzeResult): string {
  try {
    const hostname = new URL(result.finalUrl).hostname.replace(/[^a-z0-9.-]/gi, "-");
    return `sga-report-${hostname || "website"}.html`;
  } catch {
    return "sga-analytics-report.html";
  }
}

export function renderSharedReportHtml(
  result: AnalyzeResult,
  expiresAt: string
): string {
  const scores = [
    ["Overall", result.overallScore],
    ["SEO", result.seo.score],
    ["AEO", result.aeo.score],
    ["GEO", result.geo.score],
    ["Speed", result.speed.score],
    ["Technical", result.technical.score],
    ["Domain Rating", result.domainRating.score],
  ] as const;

  const recommendations = result.aiRecommendations
    .map((tip) => `<li>${escapeHtml(tip)}</li>`)
    .join("");
  const gaps = result.citability.gaps
    .map((gap) => `<li>${escapeHtml(gap)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>SGA Analytics report — ${escapeHtml(result.finalUrl)}</title>
  <style>
    :root{--ink:#0f172a;--muted:#64748b;--line:#d9e4e2;--brand:#0d9488;--bg:#f4f7f6}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 Arial,sans-serif}
    main{max-width:1040px;margin:auto;padding:36px 20px 64px}.top{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:28px}
    .brand{font-size:21px;font-weight:800}.brand span{color:var(--brand)}.muted{color:var(--muted)}
    .panel{background:#fff;border:1px solid var(--line);border-radius:18px;padding:24px;margin:16px 0;box-shadow:0 14px 40px -28px rgba(13,148,136,.45)}
    h1{font-size:28px;line-height:1.2;margin:8px 0}h2{font-size:18px;margin:0}h3{font-size:14px;margin:18px 0 8px}
    a{color:#0f766e;overflow-wrap:anywhere}.scores{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
    .metric{border:1px solid var(--line);border-radius:14px;padding:14px}.metric b{display:block;font-size:28px}.metric span{color:var(--muted);font-size:12px}
    .section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.score{min-width:46px;text-align:center;border-radius:999px;padding:7px 10px;font-weight:800}
    .good{background:#ccfbf1;color:#115e59}.fair{background:#cffafe;color:#155e75}.warn{background:#fef3c7;color:#92400e}.poor{background:#ffe4e6;color:#9f1239}
    table{width:100%;border-collapse:collapse}th,td{padding:11px 8px;border-top:1px solid #eef2f1;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
    .num{text-align:right;font-variant-numeric:tabular-nums}.status{display:inline-block;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:800}.pass{background:#d1fae5;color:#065f46}.fail{background:#ffe4e6;color:#9f1239}
    ul{padding-left:20px}.facts{display:grid;grid-template-columns:1fr 1fr;gap:14px}.fact{padding:12px;border:1px solid #eef2f1;border-radius:12px}.fact b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px}
    footer{margin-top:30px;color:var(--muted);font-size:11px;text-align:center}@media(max-width:700px){.scores{grid-template-columns:repeat(2,1fr)}.facts{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}}
    @media print{body{background:#fff}.panel{box-shadow:none;break-inside:avoid}main{max-width:none;padding:0}}
  </style>
</head>
<body><main>
  <div class="top"><div class="brand">SGA <span>Analytics</span></div><div class="muted">Saved HTML report</div></div>
  <section class="panel">
    <div class="muted">Analyzed URL</div>
    <h1><a href="${safeUrl(result.finalUrl)}">${escapeHtml(result.finalUrl)}</a></h1>
    <div class="muted">Analyzed ${escapeHtml(new Date(result.analyzedAt).toLocaleString("en-US", { timeZone: "UTC" }))} UTC · Share link expires ${escapeHtml(new Date(expiresAt).toLocaleString("en-US", { timeZone: "UTC" }))} UTC</div>
    <div class="scores">${scores
      .map(([label, score]) => `<div class="metric"><b>${score}</b><span>${escapeHtml(label)}</span></div>`)
      .join("")}</div>
  </section>
  <section class="panel">
    <div class="section-head"><h2>LLM citability</h2><span class="score ${scoreTone(result.citability.score)}">${result.citability.score}</span></div>
    <p><strong>${escapeHtml(result.citability.verdict.replaceAll("-", " "))}</strong> — ${escapeHtml(result.citability.reason)}</p>
    ${gaps ? `<h3>Gaps</h3><ul>${gaps}</ul>` : ""}
  </section>
  ${categoryHtml("SEO", result.seo)}
  ${categoryHtml("AEO", result.aeo)}
  ${categoryHtml("GEO", result.geo)}
  ${categoryHtml("Speed", result.speed)}
  ${categoryHtml("Technical", result.technical)}
  <section class="panel"><h2>Recommendations</h2>${result.aiSummary ? `<p>${escapeHtml(result.aiSummary)}</p>` : ""}<ul>${recommendations}</ul></section>
  <section class="panel"><h2>Page signals</h2><div class="facts">
    <div class="fact"><b>Title</b>${escapeHtml(result.signals.title || "None")}</div>
    <div class="fact"><b>Meta description</b>${escapeHtml(result.signals.metaDescription || "None")}</div>
    <div class="fact"><b>JSON-LD</b>${escapeHtml(result.signals.jsonLdTypes.join(", ") || "None")}</div>
    <div class="fact"><b>Content</b>${result.signals.wordCount} words · ${(result.signals.htmlSizeBytes / 1024).toFixed(1)} KB HTML</div>
    <div class="fact"><b>Crawl files</b>robots.txt: ${result.signals.hasRobotsTxt ? "yes" : "no"} · sitemap: ${result.signals.hasSitemap ? "yes" : "no"} · llms.txt: ${result.signals.hasLlmsTxt ? "yes" : "no"}</div>
    <div class="fact"><b>Response</b>${result.signals.loadTimeMs} ms · ${escapeHtml(result.signals.fetchSource)}</div>
  </div></section>
  <footer>Generated by SGA Analytics · This downloaded file remains available after the temporary share link expires.</footer>
</main></body></html>`;
}
