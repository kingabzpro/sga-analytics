"use client";

import { useEffect, useState } from "react";
import { Show, UserButton, useAuth, useClerk } from "@clerk/nextjs";
import type { AnalyzeResult } from "@/lib/types";
import type { AuditQuotaStatus } from "@/lib/audit-quota";
import { Logo } from "./Logo";
import { ReportView } from "./ReportView";
import { AuditHistoryPanel } from "./AuditHistoryPanel";
import { clerkAppearance } from "@/lib/clerk-theme";

type ProgressEntry = {
  stage: string;
  message: string;
  elapsedMs: number;
};

async function fetchAuditQuota(): Promise<AuditQuotaStatus | null> {
  const response = await fetch("/api/quota", { cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<AuditQuotaStatus>;
}

function ClerkAnalyzerApp() {
  const clerk = useClerk();
  const { userId } = useAuth();

  return (
    <AnalyzerExperience
      authEnabled
      authSessionKey={userId ?? "signed-out"}
      onRequestSignIn={() =>
        clerk.openSignIn({
          appearance: clerkAppearance,
          fallbackRedirectUrl: "/",
          withSignUp: true,
        })
      }
    />
  );
}

export function AnalyzerApp({ authEnabled = false }: { authEnabled?: boolean }) {
  return authEnabled ? <ClerkAnalyzerApp /> : <AnalyzerExperience />;
}

function AnalyzerExperience({
  authEnabled = false,
  authSessionKey = "disabled",
  onRequestSignIn,
}: {
  authEnabled?: boolean;
  authSessionKey?: string;
  onRequestSignIn?: () => void;
}) {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [cached, setCached] = useState(false);
  const [shareProof, setShareProof] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [quota, setQuota] = useState<AuditQuotaStatus | null>(null);
  const [comparisonBase, setComparisonBase] = useState<AnalyzeResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState("");

  useEffect(() => {
    if (!authEnabled) return;
    let active = true;
    void fetchAuditQuota().then((nextQuota) => {
      if (active) setQuota(nextQuota);
    });
    return () => {
      active = false;
    };
  }, [authEnabled, authSessionKey]);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function runAudit(
    targetUrl: string,
    options: { fresh?: boolean; fallbackComparison?: AnalyzeResult | null } = {}
  ) {
    if (quota?.remaining === 0) {
      if (!quota.authenticated && onRequestSignIn) {
        onRequestSignIn();
      } else {
        setError(`You have used all ${quota.limit ?? 5} free member audits.`);
      }
      return;
    }

    setElapsedSeconds(0);
    setLoading(true);
    setError(null);
    setResult(null);
    setCached(false);
    setShareProof(null);
    setComparisonBase(null);
    setProgressEntries([]);

    try {
      const res = await fetch("/api/analyze/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, fresh: options.fresh === true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        if (data?.code === "SIGN_IN_REQUIRED" && onRequestSignIn) {
          setError(null);
          onRequestSignIn();
          return;
        }
        throw new Error(data?.error || "Analysis failed");
      }
      if (!res.body) throw new Error("Progress stream unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: AnalyzeResult | null = null;
      let finalComparisonBase = options.fallbackComparison ?? null;
      let finalHistoryId: string | null = null;

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
            cached?: boolean;
            shareProof?: string | null;
            historyId?: string | null;
            comparisonBase?: AnalyzeResult | null;
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
            setCached(Boolean(event.cached));
            setShareProof(event.shareProof ?? null);
            finalHistoryId = event.historyId ?? null;
            if (event.comparisonBase !== undefined) {
              finalComparisonBase = event.comparisonBase;
            }
          } else if (event.type === "error") {
            throw new Error(event.error || "Analysis failed");
          }
        }
        if (done) break;
      }

      if (!finalResult) throw new Error("Analysis finished without a report");
      setResult(finalResult);
      setComparisonBase(finalComparisonBase);
      setUrl(finalResult.finalUrl);
      if (finalHistoryId) setHistoryRefreshKey(finalHistoryId);
      if (authEnabled) {
        const nextQuota = await fetchAuditQuota();
        if (nextQuota) setQuota(nextQuota);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runAudit(url);
  }

  async function openHistoryEntry(id: string) {
    const response = await fetch(`/api/history/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as
      | {
          entry?: { result: AnalyzeResult };
          shareProof?: string | null;
          error?: string;
        }
      | null;
    if (!response.ok || !body?.entry) {
      throw new Error(body?.error || "Could not open this audit.");
    }
    setResult(body.entry.result);
    setUrl(body.entry.result.finalUrl);
    setCached(false);
    setComparisonBase(null);
    setShareProof(body.shareProof ?? null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const analyzerBody = (
    <>
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

      {result ? (
        <ReportView
          result={result}
          cached={cached}
          shareProof={shareProof}
          comparisonBase={comparisonBase}
          onReaudit={() =>
            void runAudit(result.finalUrl, {
              fresh: true,
              fallbackComparison: result,
            })
          }
          reauditDisabled={loading || quota?.remaining === 0}
        />
      ) : null}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:py-14">
      <nav className="mb-10 flex items-center justify-between gap-4">
        <Logo size="md" />
        {authEnabled ? (
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <button
                type="button"
                onClick={onRequestSignIn}
                className="rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-teal-700 shadow-sm ring-1 ring-teal-200 transition hover:bg-teal-50"
              >
                Sign in
              </button>
            </Show>
            <Show when="signed-in">
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="rounded-xl bg-white/90 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-teal-50 hover:text-teal-700 hover:ring-teal-200"
              >
                History
              </button>
              {quota?.remaining != null ? (
                <span className="hidden rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-teal-100 sm:inline-flex">
                  {quota.remaining} free {quota.remaining === 1 ? "audit" : "audits"} left
                </span>
              ) : null}
              <UserButton appearance={clerkAppearance} />
            </Show>
          </div>
        ) : (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-teal-100">
              Free URL audit
            </span>
          </div>
        )}
      </nav>

      <header className="mx-auto mb-10 max-w-3xl text-center">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800 ring-1 ring-teal-100">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          Website scoring
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
          Score any site for{" "}
          <span className="text-brand-gradient">SEO, GEO &amp; AEO</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600 sm:text-base">
          Paste a URL to audit on-page SEO, generative-engine, and answer-engine
          signals — plus practical ways to improve.
        </p>
      </header>

      {analyzerBody}

      {authEnabled && quota && !result && !loading ? (
        <p className="-mt-5 mb-8 text-center text-xs text-slate-500">
          {quota.authenticated
            ? `${quota.remaining} of ${quota.limit} member audits remaining`
            : quota.remaining === 1
              ? "Your first audit is free — no account needed"
              : "Free audit used — sign in to unlock 5 more"}
        </p>
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
              title: "GEO",
              body: "Structured data, AI crawl access, and trust signals for generative engines.",
              tone: "text-emerald-700 bg-emerald-50 ring-emerald-100",
            },
            {
              title: "AEO",
              body: "Answer-ready pages with clear Q&A patterns and snippet-friendly layout.",
              tone: "text-cyan-700 bg-cyan-50 ring-cyan-100",
            },
          ].map((item) => (
            <div key={item.title} className="glass-panel rounded-2xl px-4 py-4 text-left">
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

      {authEnabled && historyOpen ? (
        <AuditHistoryPanel
          onClose={() => setHistoryOpen(false)}
          onSelect={openHistoryEntry}
          refreshKey={`${authSessionKey}:${historyRefreshKey}`}
        />
      ) : null}
    </div>
  );
}
