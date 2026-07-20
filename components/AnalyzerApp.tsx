"use client";

import { useState } from "react";
import type { AnalyzeResult } from "@/lib/types";
import { Logo } from "./Logo";
import { ScoreCards } from "./ScoreCards";
import { CheckList } from "./CheckList";
import { Recommendations } from "./Recommendations";

export function AnalyzerApp() {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Analysis failed");
      }
      setResult(data as AnalyzeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:py-14">
      {/* Top bar */}
      <nav className="mb-10 flex items-center justify-between gap-4">
        <Logo size="md" />
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/80">
            Free URL audit
          </span>
        </div>
      </nav>

      {/* Hero */}
      <header className="mx-auto mb-10 max-w-3xl text-center">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 ring-1 ring-indigo-100">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          Website scoring
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
          Score any site for{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            SEO, AEO &amp; GEO
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600 sm:text-base">
          Paste a URL to audit on-page SEO, answer-engine readiness, and
          generative-engine signals, plus practical ways to improve.
        </p>
      </header>

      {/* Search */}
      <form
        onSubmit={onSubmit}
        className="glass-panel mx-auto mb-8 flex w-full max-w-2xl flex-col gap-3 rounded-2xl p-2 sm:flex-row sm:items-center sm:gap-2 sm:p-2"
      >
        <label htmlFor="url" className="sr-only">
          Website URL
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-slate-200/90 focus-within:ring-2 focus-within:ring-indigo-300">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0 text-slate-400"
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
            className="input-focus min-w-0 flex-1 border-0 bg-transparent py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
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
        <div className="glass-panel mx-auto mb-8 flex max-w-2xl items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm text-slate-600">
          <span className="flex gap-1" aria-hidden>
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span
              className="pulse-dot h-1.5 w-1.5 rounded-full bg-indigo-500"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="pulse-dot h-1.5 w-1.5 rounded-full bg-violet-500"
              style={{ animationDelay: "0.4s" }}
            />
          </span>
          Fetching the page, running open-source checks, and generating tips…
        </div>
      ) : null}

      {error ? (
        <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!result && !loading && !error ? (
        <div className="mx-auto mb-4 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              title: "SEO",
              body: "Titles, meta, structure, and content signals search engines rely on.",
            },
            {
              title: "AEO",
              body: "Answer-ready pages with clear Q&A patterns and snippet-friendly layout.",
            },
            {
              title: "GEO",
              body: "Structured data, AI crawl access, and trust signals for generative engines.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="glass-panel rounded-2xl px-4 py-4 text-left"
            >
              <div className="font-mono-nums text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600">
                {item.title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-6 animate-[fadeIn_0.35s_ease]">
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
                  className="mt-1 block truncate text-base font-semibold text-slate-900 hover:text-indigo-700"
                >
                  {result.finalUrl}
                </a>
                <p className="mt-1 font-mono-nums text-xs text-slate-500">
                  {new Date(result.analyzedAt).toLocaleString()} ·{" "}
                  {result.signals.wordCount} words · {result.signals.loadTimeMs}
                  ms load
                </p>
              </div>
            </div>
            <ScoreCards result={result} />
          </div>

          <Recommendations result={result} />

          <div className="grid gap-4 md:grid-cols-3">
            <CheckList title="SEO checks" category={result.seo} kind="SEO" />
            <CheckList title="AEO checks" category={result.aeo} kind="AEO" />
            <CheckList title="GEO checks" category={result.geo} kind="GEO" />
          </div>

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
        </div>
      ) : null}

      <footer className="mt-14 border-t border-slate-200/70 pt-6 text-center">
        <p className="text-xs leading-relaxed text-slate-400">
          Open-source checks with cheerio, seord, and robots-parser
          {result?.aiSource === "huggingface"
            ? ", plus DeepSeek-V4-Flash on Fireworks"
            : ""}
          .
        </p>
      </footer>
    </div>
  );
}
