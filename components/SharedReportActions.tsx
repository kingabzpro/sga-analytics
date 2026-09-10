"use client";

import { useState } from "react";

export function SharedReportActions({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={copyLink}
        className="cursor-pointer rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
      >
        {copied ? "Copied successfully" : "Copy link"}
      </button>
      <a
        href={`/report/${encodeURIComponent(id)}/html`}
        download
        className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
      >
        Save as HTML
      </a>
    </div>
  );
}
