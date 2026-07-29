"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { AnalyzeResult, CategoryScore } from "@/lib/types";
import { AnimatedRing, CountUp } from "./motion-helpers";

function ringColor(score: number) {
  if (score >= 80) return "#0d9488";
  if (score >= 60) return "#0891b2";
  if (score >= 40) return "#f59e0b";
  return "#e11d48";
}

function labelColor(score: number) {
  if (score >= 80) return "text-teal-700";
  if (score >= 60) return "text-cyan-700";
  if (score >= 40) return "text-amber-700";
  return "text-rose-700";
}

type TabKey = "SEO" | "AEO" | "GEO" | "Speed";

const TABS: { key: TabKey; label: string; accent: string; chip: string }[] = [
  { key: "SEO", label: "SEO", accent: "teal", chip: "bg-teal-500" },
  { key: "AEO", label: "AEO", accent: "cyan", chip: "bg-cyan-500" },
  { key: "GEO", label: "GEO", accent: "emerald", chip: "bg-emerald-500" },
  { key: "Speed", label: "Speed", accent: "amber", chip: "bg-amber-500" },
];

/** Hero card: the Overall score as a large animated ring, plus the Domain
 *  Rating number folded in compactly so the empty space is used. */
function OverallHero({ result }: { result: AnalyzeResult }) {
  const score = result.overallScore;
  const dr = result.domainRating;
  const drLive = dr.source === "openpagerank";

  return (
    <div className="glass-panel relative grid grid-cols-1 gap-5 overflow-hidden rounded-2xl p-6 sm:grid-cols-[auto_1fr] sm:gap-7 sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: ringColor(score) }}
      />
      {/* Overall ring */}
      <div className="mx-auto flex items-center sm:mx-0">
        <AnimatedRing value={score} size={132} stroke={10} color={ringColor(score)}>
          <CountUp
            value={score}
            className="font-mono-nums text-4xl font-semibold tracking-tight text-slate-900"
          />
        </AnimatedRing>
      </div>

      {/* Verdict + DR + category chips — fills the ring's height, no dead space */}
      <div className="flex min-w-0 flex-col justify-center gap-4 text-center sm:items-start sm:text-left">
        <div>
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Overall score
            </span>
            <span
              className={`font-display text-2xl font-semibold ${labelColor(score)}`}
            >
              {score >= 80
                ? "Strong"
                : score >= 60
                  ? "Decent"
                  : score >= 40
                    ? "Needs work"
                    : "Weak"}
            </span>
          </div>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
            Weighted blend of SEO, AEO, GEO, and Speed. Explore each area in the
            tabs below.
          </p>
        </div>

        {/* Domain Rating + category chips on one row — compact, no empty space */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex items-baseline gap-1.5 rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-200">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Domain Rating
            </span>
            <CountUp
              value={dr.score}
              className={`font-mono-nums text-lg font-semibold ${labelColor(dr.score)}`}
            />
            <span className="text-[10px] text-slate-400">
              {drLive ? "OPR" : "est"}
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {(
              [
                ["SEO", result.seo.score],
                ["AEO", result.aeo.score],
                ["GEO", result.geo.score],
                ["Speed", result.speed.score],
              ] as [string, number][]
            ).map(([label, s]) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: ringColor(s) }}
                  aria-hidden
                />
                <span className="font-mono-nums font-semibold text-slate-800">
                  {s}
                </span>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A single check row, animated in. */
function CheckRow({
  check,
  accent,
}: {
  check: AnalyzeResult["seo"]["checks"][number];
  accent: string;
}) {
  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, x: -10 },
        show: {
          opacity: 1,
          x: 0,
          transition: { type: "spring" as const, stiffness: 260, damping: 24 },
        },
      }}
      className="flex gap-3 rounded-xl border border-slate-100 bg-white/80 px-3 py-2.5 transition-colors hover:border-teal-200 hover:bg-teal-50/40"
    >
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          check.passed ? "check-pass" : "check-fail"
        }`}
        aria-hidden
      >
        {check.passed ? "✓" : "!"}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">
            {check.label}
          </span>
          <span className={`h-1.5 w-1.5 rounded-full ${accent}`} aria-hidden />
        </div>
        <div className="mt-0.5 text-xs leading-relaxed text-slate-500">
          {check.detail}
        </div>
      </div>
    </motion.li>
  );
}

/** Content for one tab: a category ring + its checks. */
function TabPanel({
  title,
  subtitle,
  category,
  accent,
}: {
  title: string;
  subtitle: string;
  category: CategoryScore;
  accent: string;
}) {
  const passed = category.checks.filter((c) => c.passed).length;
  const total = category.checks.length;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* score summary */}
      <div className="lg:col-span-2">
        <div className="glass-panel flex h-full flex-col items-center rounded-2xl p-5">
          <AnimatedRing
            value={category.score}
            size={116}
            stroke={9}
            color={ringColor(category.score)}
          >
            <CountUp
              value={category.score}
              className="font-mono-nums text-3xl font-semibold tracking-tight text-slate-900"
            />
          </AnimatedRing>
          <div
            className={`mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] ${labelColor(category.score)}`}
          >
            {title}
          </div>
          <div className="mt-1 text-center text-xs text-slate-500">{subtitle}</div>
          <div className="mt-4 w-full">
            <div className="mb-1.5 flex justify-between text-[11px] text-slate-500">
              <span>
                {passed} of {total} passed
              </span>
              <span className="font-mono-nums">{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className={`h-full rounded-full ${accent}`}
                initial={{ width: "0%" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* checks */}
      <div className="lg:col-span-3">
        <motion.ul
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.04 } } }}
          className="space-y-2"
        >
          {category.checks.map((check) => (
            <CheckRow key={check.id} check={check} accent={accent} />
          ))}
        </motion.ul>
      </div>
    </div>
  );
}

export function ScoreCards({ result }: { result: AnalyzeResult }) {
  const [active, setActive] = useState<TabKey>("SEO");

  const panel = (() => {
    switch (active) {
      case "SEO":
        return (
          <TabPanel
            title="SEO"
            subtitle="Search engines"
            category={result.seo}
            accent="bg-teal-500"
          />
        );
      case "AEO":
        return (
          <TabPanel
            title="AEO"
            subtitle="Answer engines"
            category={result.aeo}
            accent="bg-cyan-500"
          />
        );
      case "GEO":
        return (
          <TabPanel
            title="GEO"
            subtitle="Generative engines"
            category={result.geo}
            accent="bg-emerald-500"
          />
        );
      case "Speed":
        return (
          <TabPanel
            title="Speed"
            subtitle="Page performance"
            category={result.speed}
            accent="bg-amber-500"
          />
        );
    }
  })();

  return (
    <div className="space-y-4">
      <OverallHero result={result} />

      {/* Tab bar */}
      <div className="glass-panel flex gap-1 rounded-2xl p-1.5">
        {TABS.map((t) => {
          const isActive = t.key === active;
          const s =
            t.key === "SEO"
              ? result.seo.score
              : t.key === "AEO"
                ? result.aeo.score
                : t.key === "GEO"
                  ? result.geo.score
                  : result.speed.score;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors sm:px-4 ${
                isActive
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="active-tab"
                  className="absolute inset-0 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
              <span
                className={`relative z-10 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {s}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active panel with smooth transition between tabs */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {panel}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
