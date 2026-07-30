"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { AnalyzeResult, PsiMetrics } from "@/lib/types";
import { Logo } from "./Logo";
import { ScoreCards } from "./ScoreCards";
import { Recommendations } from "./Recommendations";
import { CitabilityCard } from "./CitabilityCard";

type ProgressEntry = {
  stage: string;
  message: string;
  elapsedMs: number;
};

/** Compact Core Web Vitals readout for the page-signals snapshot.
 *  Prefers field (CrUX p75) values; lab fills the gaps. */
function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s` : `${Math.round(ms)}ms`;
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
          {" "}
          ·{" "}
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

export function AnalyzerApp() {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setElapsedSeconds(0);
    setLoading(true);
    setError(null);
    setResult(null);
    setProgressEntries([]);

    try {
      const res = await fetch("/api/analyze/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Analysis failed");
      }
      if (!res.body) throw new Error("Progress stream unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: AnalyzeResult | null = null;

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: "progress" | "result" | "error";
            stage?: string;
            message?: string;
            elapsedMs?: number;
            result?: AnalyzeResult;
            error?: string;
          };
          if (event.type === "progress" && event.message && event.stage) {
            setProgressEntries((current) => [
              ...current,
              {
                stage: event.stage!,
                message: event.message!,
                elapsedMs: event.elapsedMs ?? 0,
              },
            ]);
          } else if (event.type === "result" && event.result) {
            finalResult = event.result;
          } else if (event.type === "error") {
            throw new Error(event.error || "Analysis failed");
          }
        }
        if (done) break;
      }

      if (!finalResult) throw new Error("Analysis finished without a report");
      setResult(finalResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:py-14">
      <nav className="mb-10 flex items-center justify-between gap-4">
        <Logo size="md" />
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-teal-100">
            Free URL audit
          </span>
        </div>
      </nav>

      <header className="mx-auto mb-10 max-w-3xl text-center">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800 ring-1 ring-teal-100">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          Website scoring
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
          Score any site for{" "}
          <span className="text-brand-gradient">SEO, AEO &amp; GEO</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600 sm:text-base">
          Paste a URL to audit on-page SEO, answer-engine, and generative-engine
          signals — plus practical ways to improve.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="glass-panel mx-auto mb-8 flex w-full max-w-2xl flex-col gap-3 rounded-2xl p-2 sm:flex-row sm:items-center sm:gap-2 sm:p-2"
      >
        <label htmlFor="url" className="sr-only">
          Website URL
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-slate-200/90">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0 text-teal-600/70"
            aria-hidden
          >
            <path
              d="M10 4h4a6 6 0 0 1 0 12h-1M8 8H7a6 6 0 1 0 0 12h4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
          <input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-site.com"
            className="min-w-0 flex-1 border-0 bg-transparent py-3.5 text-sm text-slate-900 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none"
            disabled={loading}
            required
            autoComplete="url"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary rounded-xl px-6 py-3.5 text-sm font-semibold text-white sm:min-w-[132px]"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {loading ? (
        <div
          className="glass-panel mx-auto mb-8 max-w-2xl rounded-2xl px-5 py-4 text-sm text-slate-600"
          aria-live="polite"
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <span className="font-semibold text-slate-800">Audit in progress</span>
            <span className="font-mono-nums text-xs text-slate-400">
              {elapsedSeconds}s
            </span>
          </div>
          <ol className="space-y-2">
            {progressEntries.map((entry, index) => {
              const active = index === progressEntries.length - 1;
              return (
                <li
                  key={`${entry.stage}-${entry.elapsedMs}-${index}`}
                  className={`flex items-center gap-2 ${active ? "text-teal-700" : "text-slate-500"}`}
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] ${
                      active
                        ? "bg-teal-100 text-teal-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                    aria-hidden
                  >
                    {active ? "•" : "✓"}
                  </span>
                  <span className="min-w-0 flex-1">{entry.message}</span>
                  <span className="font-mono-nums text-[10px] text-slate-400">
                    {(entry.elapsedMs / 1000).toFixed(1)}s
                  </span>
                </li>
              );
            })}
            {progressEntries.length === 0 ? (
              <li className="flex items-center gap-2 text-teal-700">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-teal-100 text-[10px]">
                  •
                </span>
                Connecting to the analyzer…
              </li>
            ) : null}
          </ol>
          {elapsedSeconds >= 10 ? (
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
              Still working—some sites and AI responses take a little longer.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!result && !loading && !error ? (
        <div className="mx-auto mb-4 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "SEO",
              body: "Titles, meta, structure, and content signals search engines rely on.",
              tone: "text-teal-700 bg-teal-50 ring-teal-100",
            },
            {
              title: "AEO",
              body: "Answer-ready pages with clear Q&A patterns and snippet-friendly layout.",
              tone: "text-cyan-700 bg-cyan-50 ring-cyan-100",
            },
            {
              title: "GEO",
              body: "Structured data, AI crawl access, and trust signals for generative engines.",
              tone: "text-emerald-700 bg-emerald-50 ring-emerald-100",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="glass-panel rounded-2xl px-4 py-4 text-left"
            >
              <div
                className={`inline-flex rounded-md px-2 py-0.5 font-mono-nums text-[11px] font-semibold uppercase tracking-[0.16em] ring-1 ${item.tone}`}
              >
                {item.title}
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {result ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          <div className="glass-panel rounded-2xl p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
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
                  {new Date(result.analyzedAt).toLocaleString()} ·{" "}
                  {result.signals.wordCount} words · {result.signals.loadTimeMs}
                  ms load · {(result.signals.htmlSizeBytes / 1024).toFixed(0)}{" "}
                  KB
                </p>
                {result.signals.fetchSource === "reader" ? (
                  <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                    Protected site · content extracted; origin-header checks are limited
                  </p>
                ) : null}
              </div>
            </div>
            <ScoreCards result={result} />
          </div>

          <CitabilityCard probe={result.citability} />

          <Recommendations result={result} />

          <details className="glass-panel group rounded-2xl p-5 text-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-800">
              <span>Page signals snapshot</span>
              <span className="text-slate-400 transition group-open:rotate-180">
                ▾
              </span>
            </summary>
            <dl className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Title
                </dt>
                <dd className="mt-1 text-slate-800">
                  {result.signals.title || "None"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Meta description
                </dt>
                <dd className="mt-1 text-slate-800">
                  {result.signals.metaDescription || "None"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  JSON-LD types
                </dt>
                <dd className="mt-1 text-slate-800">
                  {result.signals.jsonLdTypes.join(", ") || "None"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Crawl files
                </dt>
                <dd className="mt-1 text-slate-800">
                  robots.txt: {result.signals.hasRobotsTxt ? "yes" : "no"} ·
                  sitemap: {result.signals.hasSitemap ? "yes" : "no"} ·
                  llms.txt: {result.signals.hasLlmsTxt ? "yes" : "no"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Page weight
                </dt>
                <dd className="mt-1 font-mono-nums text-slate-800">
                  {(result.signals.htmlSizeBytes / 1024).toFixed(1)} KB HTML ·{" "}
                  {result.signals.loadTimeMs} ms response
                </dd>
              </div>
              {result.psiMetrics ? (
                <CwvRow psi={result.psiMetrics} />
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  AI bots (robots.txt)
                </dt>
                <dd className="mt-1 font-mono-nums text-xs leading-relaxed text-slate-700 sm:text-sm">
                  {result.signals.aiBots
                    .map((b) => {
                      const state =
                        b.allowed === null
                          ? "?"
                          : b.allowed
                            ? "allow"
                            : "block";
                      return `${b.name}:${state}`;
                    })
                    .join(" · ")}
                </dd>
              </div>
            </dl>
          </details>
        </motion.div>
      ) : null}

      <footer className="mt-14 border-t border-slate-200/70 pt-5 text-center text-[11px] tracking-wide text-slate-400">
        <span>© 2026 SGA Analytics · Built with love by </span>
        <a
          href="https://www.linkedin.com/in/1abidaliawan/"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-slate-500 underline decoration-teal-300 underline-offset-4 transition hover:text-teal-700"
        >
          Abid Ali Awan ↗
        </a>
      </footer>
    </div>
  );
}
