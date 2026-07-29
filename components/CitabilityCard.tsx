"use client";

import { motion } from "motion/react";
import type { CitabilityProbe } from "@/lib/types";
import { AnimatedRing, CountUp } from "./motion-helpers";

const VERDICT_META: Record<
  CitabilityProbe["verdict"],
  { label: string; color: string; ring: string; pill: string }
> = {
  "would-cite": {
    label: "Would cite",
    color: "#0d9488",
    ring: "bg-teal-500",
    pill: "bg-teal-50 text-teal-800 ring-teal-200",
  },
  partial: {
    label: "Partially",
    color: "#f59e0b",
    ring: "bg-amber-500",
    pill: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  "would-not-cite": {
    label: "Would not cite",
    color: "#e11d48",
    ring: "bg-rose-500",
    pill: "bg-rose-50 text-rose-800 ring-rose-200",
  },
};

/**
 * The flagship phase-4 card: an LLM ("would ChatGPT cite this?") verdict for the
 * audited page, judged against an auto-derived query. Sits above the tabbed
 * score cards to foreground citability readiness.
 */
export function CitabilityCard({ probe }: { probe: CitabilityProbe }) {
  const meta = VERDICT_META[probe.verdict];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5 shadow-sm sm:p-6"
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-25 blur-3xl"
        style={{ background: meta.color }}
        aria-hidden
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
        {/* Score ring */}
        <div className="mx-auto flex shrink-0 sm:mx-0">
          <AnimatedRing value={probe.score} size={108} stroke={9} color={meta.color}>
            <CountUp
              value={probe.score}
              className="font-mono-nums text-3xl font-semibold tracking-tight text-slate-900"
            />
            <span className="text-[10px] font-medium text-slate-400">/100</span>
          </AnimatedRing>
        </div>

        {/* Verdict + query + reason + gaps */}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h3 className="font-display text-lg font-semibold text-slate-900">
              LLM citability
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${meta.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.ring}`} aria-hidden />
              {meta.label}
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500 ring-1 ring-slate-200">
              {probe.source === "mistral" ? "Mistral" : "rule-based"}
            </span>
          </div>

          <p className="mt-1.5 text-xs text-slate-500">
            Judged for: <span className="font-medium text-slate-700">
              &ldquo;{probe.query}&rdquo;
            </span>
          </p>

          {probe.reason ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-700">
              {probe.reason}
            </p>
          ) : null}

          {probe.gaps.length > 0 ? (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {probe.gaps.map((g, i) => (
                <span
                  key={`${i}-${g.slice(0, 12)}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200"
                >
                  <span className="h-1 w-1 rounded-full bg-slate-400" aria-hidden />
                  {g}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
