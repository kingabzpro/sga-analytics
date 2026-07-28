"use client";

import { motion } from "motion/react";
import type { AnalyzeResult, DomainRating } from "@/lib/types";
import {
  AnimatedRing,
  CountUp,
  cardContainer,
  cardItem,
} from "./motion-helpers";

function ringColor(score: number) {
  if (score >= 80) return "#0d9488";
  if (score >= 60) return "#0891b2";
  if (score >= 40) return "#f59e0b";
  return "#e11d48";
}

function tint(score: number) {
  if (score >= 80) return "from-teal-50/90 to-white";
  if (score >= 60) return "from-cyan-50/90 to-white";
  if (score >= 40) return "from-amber-50/90 to-white";
  return "from-rose-50/80 to-white";
}

function labelColor(score: number) {
  if (score >= 80) return "text-teal-700";
  if (score >= 60) return "text-cyan-700";
  if (score >= 40) return "text-amber-700";
  return "text-rose-700";
}

function ScoreRing({
  label,
  score,
  subtitle,
  featured = false,
}: {
  label: string;
  score: number;
  subtitle?: string;
  featured?: boolean;
}) {
  const size = featured ? 116 : 96;
  const stroke = featured ? 9 : 8;

  return (
    <motion.div
      variants={cardItem}
      whileHover={{ y: -4 }}
      className={`score-card flex flex-col items-center rounded-2xl bg-gradient-to-b p-4 sm:p-5 ${tint(score)}`}
    >
      <AnimatedRing
        value={score}
        size={size}
        stroke={stroke}
        color={ringColor(score)}
      >
        <CountUp
          value={score}
          className={`font-mono-nums font-semibold tracking-tight text-slate-900 ${
            featured ? "text-3xl" : "text-2xl"
          }`}
        />
      </AnimatedRing>
      <div
        className={`mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] ${labelColor(score)}`}
      >
        {label}
      </div>
      {subtitle ? (
        <div className="mt-1 text-center text-xs leading-snug text-slate-500">
          {subtitle}
        </div>
      ) : null}
    </motion.div>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/**
 * Domain Rating hero card. Visually distinct from the on-page rings: a wider
 * accent band and the raw provider metrics. Always shows whether the number is
 * authoritative (Open PageRank) or a rough on-page estimate.
 */
function DomainRatingCard({ rating }: { rating: DomainRating }) {
  const live = rating.source === "openpagerank";
  const score = rating.score;
  const color = ringColor(score);

  return (
    <motion.div
      variants={cardItem}
      whileHover={{ y: -4 }}
      className="score-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-25 blur-2xl"
        style={{ background: color }}
      />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            Domain Rating
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Off-page authority · backlinks
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ring-1 ${
            live
              ? "bg-teal-400/15 text-teal-200 ring-teal-300/30"
              : "bg-amber-400/15 text-amber-200 ring-amber-300/30"
          }`}
          title={
            live
              ? "Fetched live from Open PageRank"
              : "Rough estimate from on-page signals — set OPEN_PAGE_RANK_API_KEY for a real score"
          }
        >
          {live ? "Open PageRank" : "Estimate"}
        </span>
      </div>

      <div className="relative mt-5 flex items-end gap-3">
        <CountUp
          value={score}
          className="font-mono-nums text-6xl font-semibold leading-none tracking-tight"
        />
        <span className="mb-1 text-lg font-medium text-slate-400">/100</span>
      </div>

      {/* progress bar */}
      <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: "0%" }}
          whileInView={{ width: `${score}%` }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <dl className="relative mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
            OPR
          </dt>
          <dd className="mt-1 font-mono-nums text-base font-semibold">
            {rating.rawRank !== null ? rating.rawRank.toFixed(1) : "—"}
            <span className="text-xs text-slate-400"> /10</span>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
            Global rank
          </dt>
          <dd className="mt-1 font-mono-nums text-base font-semibold">
            {rating.globalRank !== null ? `#${compact(rating.globalRank)}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
            Ref. domains
          </dt>
          <dd className="mt-1 font-mono-nums text-base font-semibold">
            {rating.referringDomains !== null
              ? compact(rating.referringDomains)
              : "—"}
          </dd>
        </div>
      </dl>

      {!live ? (
        <p className="relative mt-3 text-[11px] leading-relaxed text-slate-400">
          This is an estimate. Add an Open PageRank API key for an authoritative,
          backlink-based rating.
        </p>
      ) : null}
    </motion.div>
  );
}

/** Compact radar chart of the four on-page categories, animated. */
function CategoryRadar({ result }: { result: AnalyzeResult }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const axes = [
    { key: "SEO", value: result.seo.score, color: "#0d9488" },
    { key: "AEO", value: result.aeo.score, color: "#0891b2" },
    { key: "GEO", value: result.geo.score, color: "#10b981" },
    { key: "Speed", value: result.speed.score, color: "#f59e0b" },
  ];

  const rings = [0.25, 0.5, 0.75, 1];
  const pointAt = (i: number, frac: number) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius * frac,
      y: cy + Math.sin(angle) * radius * frac,
    };
  };

  const valuePoints = axes.map((a, i) => pointAt(i, Math.min(1, a.value / 100)));
  const valuePath =
    valuePoints
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ") + " Z";

  return (
    <motion.div
      variants={cardItem}
      className="score-card flex flex-col items-center rounded-2xl bg-gradient-to-b from-white to-slate-50/60 p-5"
    >
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        On-page balance
      </div>
      <svg width={size} height={size} className="overflow-visible">
        {rings.map((f, idx) => (
          <polygon
            key={idx}
            points={axes
              .map((_, i) => {
                const p = pointAt(i, f);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              })
              .join(" ")}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}
        {axes.map((_, i) => {
          const p = pointAt(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          );
        })}
        <motion.path
          d={valuePath}
          fill="rgba(13,148,136,0.14)"
          stroke="#0d9488"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
        />
        {axes.map((a, i) => {
          const p = pointAt(i, 1.16);
          return (
            <text
              key={a.key}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-600 text-[11px] font-semibold"
            >
              {a.key}
            </text>
          );
        })}
      </svg>
    </motion.div>
  );
}

export function ScoreCards({ result }: { result: AnalyzeResult }) {
  return (
    <motion.div
      variants={cardContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className="grid gap-3 sm:gap-4 lg:grid-cols-12"
    >
      {/* On-page score rings */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4 lg:col-span-8">
        <ScoreRing
          label="Overall"
          score={result.overallScore}
          subtitle="Weighted on-page"
          featured
        />
        <ScoreRing label="SEO" score={result.seo.score} subtitle="Search engines" />
        <ScoreRing label="AEO" score={result.aeo.score} subtitle="Answer engines" />
        <ScoreRing label="GEO" score={result.geo.score} subtitle="Generative engines" />
        <ScoreRing label="Speed" score={result.speed.score} subtitle="Performance" />
      </div>

      {/* Domain rating + radar */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:col-span-4">
        <DomainRatingCard rating={result.domainRating} />
        <CategoryRadar result={result} />
      </div>
    </motion.div>
  );
}
