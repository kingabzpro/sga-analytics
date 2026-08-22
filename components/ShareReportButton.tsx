"use client";

import { useState } from "react";
import type { AnalyzeResult } from "@/lib/types";

type CreatedShare = { url: string; expiresAt: string };

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function ShareReportButton({
  result,
  shareProof,
}: {
  result: AnalyzeResult;
  shareProof: string;
}) {
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createShare() {
    setCreating(true);
    setError(null);
    setCopied(false);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, shareProof }),
      });
      const body = (await response.json().catch(() => null)) as
        | (CreatedShare & { error?: string })
        | null;
      if (!response.ok || !body?.url) {
        throw new Error(body?.error || "Could not create the shared report.");
      }
      setCreated(body);
      setCopied(await copyText(body.url));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the shared report.");
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    setCopied(await copyText(created.url));
  }

  if (created) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
        <span className="text-emerald-700">
          {copied ? "Link copied · " : "Ready · "}expires in 24 hours
        </span>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg bg-white px-3 py-2 font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          Copy link
        </button>
        <a
          href={created.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-teal-700 px-3 py-2 font-semibold text-white transition hover:bg-teal-800"
        >
          Open report ↗
        </a>
      </div>
    );
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={createShare}
        disabled={creating}
        className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
      >
        {creating ? "Creating…" : "Share report · 24h"}
      </button>
      {error ? <p className="mt-2 max-w-xs text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
