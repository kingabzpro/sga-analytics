"use client";

import { useEffect, useState } from "react";
import type { AuditHistorySummary } from "@/lib/types";

function fmtDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export function AuditHistoryPanel({
  onClose,
  onSelect,
  refreshKey,
}: {
  onClose: () => void;
  onSelect: (id: string) => Promise<void>;
  refreshKey: string;
}) {
  const [entries, setEntries] = useState<AuditHistorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/history", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | { entries?: AuditHistorySummary[]; error?: string }
          | null;
        if (!response.ok) throw new Error(body?.error || "Could not load audit history.");
        if (active) setEntries(body?.entries ?? []);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load audit history.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function openEntry(id: string) {
    setOpeningId(id);
    setError(null);
    try {
      await onSelect(id);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this audit.");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 p-3 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-history-title"
        className="h-full w-full max-w-md overflow-y-auto rounded-3xl bg-[#f7fbfa] p-5 shadow-2xl ring-1 ring-slate-200 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700">
              Last 30 days
            </p>
            <h2 id="audit-history-title" className="mt-1 font-display text-2xl font-semibold text-slate-900">
              Audit history
            </h2>
            <p className="mt-1 text-xs text-slate-500">Open a result or re-audit it to measure progress.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close audit history"
            className="grid h-9 w-9 place-items-center rounded-xl bg-white text-lg text-slate-500 ring-1 ring-slate-200 transition hover:text-slate-900"
          >
            ×
          </button>
        </div>

        {loading ? <p className="mt-8 text-sm text-slate-500">Loading history…</p> : null}
        {error ? <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}
        {!loading && !error && entries.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-5 text-center ring-1 ring-slate-200">
            <p className="font-semibold text-slate-800">No saved audits yet</p>
            <p className="mt-1 text-xs text-slate-500">Your next signed-in audit will appear here.</p>
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              disabled={openingId !== null}
              onClick={() => void openEntry(entry.id)}
              className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-teal-300 disabled:opacity-60"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 font-mono-nums text-base font-bold text-teal-700 ring-1 ring-teal-100">
                  {entry.overallScore}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{entry.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{entry.url}</span>
                  <span className="mt-2 block font-mono-nums text-[10px] text-slate-400">
                    {openingId === entry.id ? "Opening…" : `${fmtDate(entry.analyzedAt)} UTC`}
                  </span>
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
