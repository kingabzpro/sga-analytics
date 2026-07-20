"use client";

import { useState } from "react";
import type { AnalyzeResult } from "@/lib/types";
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
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <header className="mb-10 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
          SGA Analytics
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          SEO · AEO · GEO website scores
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
          Paste a URL to audit on-page SEO, answer-engine readiness, and
          generative-engine signals — plus practical ways to improve.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="mx-auto mb-8 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
      >
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-site.com"
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none ring-indigo-500 placeholder:text-zinc-400 focus:ring-2"
          disabled={loading}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {loading ? (
        <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-center text-sm text-zinc-600 shadow-sm">
          Fetching the page, running open-source checks
          {process.env.NEXT_PUBLIC_SHOW_AI_HINT !== "0"
            ? ", and generating tips"
            : ""}
          …
        </div>
      ) : null}

      {error ? (
        <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-zinc-900 truncate">
                  {result.finalUrl}
                </div>
                <div className="text-xs text-zinc-500">
                  Analyzed {new Date(result.analyzedAt).toLocaleString()} ·{" "}
                  {result.signals.wordCount} words · load{" "}
                  {result.signals.loadTimeMs}ms
                </div>
              </div>
            </div>
            <ScoreCards result={result} />
          </div>

          <Recommendations result={result} />

          <div className="grid gap-4 md:grid-cols-3">
            <CheckList title="SEO checks" category={result.seo} />
            <CheckList title="AEO checks" category={result.aeo} />
            <CheckList title="GEO checks" category={result.geo} />
          </div>

          <details className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm shadow-sm">
            <summary className="cursor-pointer font-medium text-zinc-800">
              Page signals snapshot
            </summary>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500">Title</dt>
                <dd className="text-zinc-800">{result.signals.title || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Meta description</dt>
                <dd className="text-zinc-800">
                  {result.signals.metaDescription || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">JSON-LD types</dt>
                <dd className="text-zinc-800">
                  {result.signals.jsonLdTypes.join(", ") || "None"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Crawl files</dt>
                <dd className="text-zinc-800">
                  robots.txt: {result.signals.hasRobotsTxt ? "yes" : "no"} ·
                  sitemap: {result.signals.hasSitemap ? "yes" : "no"} · llms.txt:{" "}
                  {result.signals.hasLlmsTxt ? "yes" : "no"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">AI bots (robots.txt)</dt>
                <dd className="text-zinc-800">
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

      <footer className="mt-12 text-center text-xs text-zinc-400">
        Powered by open-source checks (cheerio, seord, robots-parser)
        {result?.aiSource === "huggingface" ? " + Hugging Face" : ""}. MVP for
        smoke-testing the pipeline.
      </footer>
    </div>
  );
}
