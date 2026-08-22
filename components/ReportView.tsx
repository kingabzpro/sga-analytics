"use client";

import { motion } from "motion/react";
import type { AnalyzeResult, PsiMetrics } from "@/lib/types";
import { ScoreCards } from "./ScoreCards";
import { CitabilityCard } from "./CitabilityCard";
import { Recommendations } from "./Recommendations";
import { ShareReportButton } from "./ShareReportButton";
import { SharedReportActions } from "./SharedReportActions";

function fmtMs(ms: number): string {
  return ms >= 1000
    ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`
    : `${Math.round(ms)}ms`;
}

function fmtDateUtc(value: string): string {
  return `${new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  })} UTC`;
}

function CwvRow({ psi }: { psi: PsiMetrics }) {
  const parts: string[] = [];
  const lcp = psi.field?.lcpMs ?? psi.lab?.lcpMs;
  if (lcp != null) parts.push(`LCP ${fmtMs(lcp)}`);
  const inp = psi.field?.inpMs;
  if (inp != null) parts.push(`INP ${fmtMs(inp)}`);
  const cls = psi.field?.cls ?? psi.lab?.cls;
  if (cls != null) parts.push(`CLS ${cls.toFixed(3)}`);

  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Core Web Vitals
      </dt>
      <dd className="mt-1 font-mono-nums text-slate-800">
        {parts.length ? parts.join(" · ") : "No field/lab data"}
        <span className="text-slate-400">
          {" "}·{" "}
          {psi.source === "crux"
            ? "CrUX field p75"
            : psi.field
              ? `field ${psi.field.overall.toLowerCase()}`
              : "lab only"}
        </span>
      </dd>
    </div>
  );
}

export function ReportView({
  result,
  cached = false,
  shareProof,
  shared,
}: {
  result: AnalyzeResult;
  cached?: boolean;
  shareProof?: string | null;
  shared?: { id: string; expiresAt: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Analyzed URL
            </p>
            <a
              href={result.finalUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-base font-semibold text-slate-900 hover:text-teal-700"
            >
              {result.finalUrl}
            </a>
            <p className="mt-1 font-mono-nums text-xs text-slate-500">
              {fmtDateUtc(result.analyzedAt)} ·{" "}
              {result.signals.wordCount} words · {result.signals.loadTimeMs} ms load ·{" "}
              {(result.signals.htmlSizeBytes / 1024).toFixed(0)} KB
            </p>
            {result.signals.fetchSource === "reader" ? (
              <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                Protected site · content extracted; origin-header checks are limited
              </p>
            ) : null}
            {cached ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700 ring-1 ring-teal-200">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Cached · analyzed {fmtDateUtc(result.analyzedAt)}
              </p>
            ) : null}
          </div>

          {shared ? (
            <SharedReportActions id={shared.id} />
          ) : shareProof ? (
            <ShareReportButton result={result} shareProof={shareProof} />
          ) : null}
        </div>
        <ScoreCards result={result} />
      </div>

      <CitabilityCard probe={result.citability} />
      <Recommendations result={result} />

      <details className="glass-panel group rounded-2xl p-5 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-800">
          <span>Page signals snapshot</span>
          <span className="text-slate-400 transition group-open:rotate-180">▾</span>
        </summary>
        <dl className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Title</dt>
            <dd className="mt-1 text-slate-800">{result.signals.title || "None"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Meta description</dt>
            <dd className="mt-1 text-slate-800">{result.signals.metaDescription || "None"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">JSON-LD types</dt>
            <dd className="mt-1 text-slate-800">{result.signals.jsonLdTypes.join(", ") || "None"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Crawl files</dt>
            <dd className="mt-1 text-slate-800">
              robots.txt: {result.signals.hasRobotsTxt ? "yes" : "no"} · sitemap:{" "}
              {result.signals.hasSitemap ? "yes" : "no"} · llms.txt:{" "}
              {result.signals.hasLlmsTxt ? "yes" : "no"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Page weight</dt>
            <dd className="mt-1 font-mono-nums text-slate-800">
              {(result.signals.htmlSizeBytes / 1024).toFixed(1)} KB HTML ·{" "}
              {result.signals.loadTimeMs} ms response
            </dd>
          </div>
          {result.psiMetrics ? <CwvRow psi={result.psiMetrics} /> : null}
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">AI bots (robots.txt)</dt>
            <dd className="mt-1 font-mono-nums text-xs leading-relaxed text-slate-700 sm:text-sm">
              {result.signals.aiBots
                .map((bot) => `${bot.name}:${bot.allowed === null ? "?" : bot.allowed ? "allow" : "block"}`)
                .join(" · ")}
            </dd>
          </div>
        </dl>
      </details>
    </motion.div>
  );
}
