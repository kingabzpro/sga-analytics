"use client";

import { motion } from "motion/react";
import type { AnalyzeResult } from "@/lib/types";
import { compareReports, type CheckChange } from "@/lib/report-comparison";

function dateLabel(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function ChangeList({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: CheckChange[];
  tone: string;
  empty: string;
}) {
  return (
    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className={`rounded-full px-2 py-0.5 font-mono-nums text-[11px] font-semibold ${tone}`}>
          {items.length}
        </span>
      </div>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="flex gap-2 text-xs leading-relaxed text-slate-600">
              <span className="mt-0.5 font-mono-nums text-[10px] font-semibold text-slate-400">
                {item.category}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
          {items.length > 5 ? (
            <li className="text-xs text-slate-400">+{items.length - 5} more</li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-400">{empty}</p>
      )}
    </div>
  );
}

export function ComparisonCard({
  previous,
  current,
}: {
  previous: AnalyzeResult;
  current: AnalyzeResult;
}) {
  const comparison = compareReports(previous, current);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700">
            Before vs. after
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-slate-900">
            Audit progress
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          {dateLabel(previous.analyzedAt)} → {dateLabel(current.analyzedAt)} UTC
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {comparison.scores.map((score) => {
          const positive = score.delta > 0;
          const negative = score.delta < 0;
          return (
            <div key={score.key} className="rounded-xl bg-white/80 px-3 py-3 ring-1 ring-slate-200/80">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                {score.label}
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono-nums text-lg font-semibold text-slate-900">
                  {score.current}
                </span>
                <span
                  className={`font-mono-nums text-[11px] font-semibold ${
                    positive
                      ? "text-emerald-600"
                      : negative
                        ? "text-rose-600"
                        : "text-slate-400"
                  }`}
                >
                  {positive ? "+" : ""}{score.delta}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ChangeList
          title="Fixed"
          items={comparison.fixed}
          tone="bg-emerald-50 text-emerald-700"
          empty="No failed checks became passes yet."
        />
        <ChangeList
          title="New issues"
          items={comparison.introduced}
          tone="bg-rose-50 text-rose-700"
          empty="No new issues detected."
        />
        <ChangeList
          title="Still unresolved"
          items={comparison.unresolved}
          tone="bg-amber-50 text-amber-700"
          empty="No checks remain unresolved."
        />
      </div>
    </motion.section>
  );
}
