"use client";

import { motion } from "motion/react";
import type { CategoryScore } from "@/lib/types";

const accents: Record<string, string> = {
  SEO: "border-t-teal-500",
  AEO: "border-t-cyan-500",
  GEO: "border-t-emerald-500",
  Speed: "border-t-amber-500",
};

const bars: Record<string, string> = {
  SEO: "from-teal-500 to-teal-400",
  AEO: "from-cyan-500 to-cyan-400",
  GEO: "from-emerald-500 to-emerald-400",
  Speed: "from-amber-500 to-amber-400",
};

const badges: Record<string, string> = {
  SEO: "bg-teal-600",
  AEO: "bg-cyan-600",
  GEO: "bg-emerald-600",
  Speed: "bg-amber-500",
};

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 260, damping: 24 } },
};

export function CheckList({
  title,
  category,
  kind = "SEO",
}: {
  title: string;
  category: CategoryScore;
  kind?: "SEO" | "AEO" | "GEO" | "Speed";
}) {
  const passed = category.checks.filter((c) => c.passed).length;
  const total = category.checks.length;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 200, damping: 26 }}
      className={`glass-panel rounded-2xl border-t-4 p-5 ${accents[kind] || accents.SEO}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {passed} of {total} checks passed
          </p>
        </div>
        <span
          className={`font-mono-nums rounded-lg px-2.5 py-1 text-sm font-semibold text-white ${badges[kind] || badges.SEO}`}
        >
          {category.score}
        </span>
      </div>

      {/* progress bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${bars[kind] || bars.SEO}`}
          initial={{ width: "0%" }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        />
      </div>

      <motion.ul
        variants={listVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        className="space-y-2"
      >
        {category.checks.map((check) => (
          <motion.li
            key={check.id}
            variants={rowVariants}
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
              <div className="text-sm font-medium text-slate-800">
                {check.label}
              </div>
              <div className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {check.detail}
              </div>
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </motion.section>
  );
}
