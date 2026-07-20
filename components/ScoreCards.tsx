import type { AnalyzeResult } from "@/lib/types";

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600 border-emerald-200 bg-emerald-50";
  if (score >= 60) return "text-amber-600 border-amber-200 bg-amber-50";
  return "text-rose-600 border-rose-200 bg-rose-50";
}

function ringColor(score: number) {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#d97706";
  return "#e11d48";
}

function ScoreRing({
  label,
  score,
  subtitle,
}: {
  label: string;
  score: number;
  subtitle?: string;
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;

  return (
    <div
      className={`flex flex-col items-center rounded-2xl border p-5 ${scoreColor(score)}`}
    >
      <svg width="96" height="96" className="-rotate-90">
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeWidth="8"
        />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={ringColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="mt-[-62px] mb-6 text-2xl font-bold tabular-nums text-zinc-900">
        {score}
      </div>
      <div className="text-sm font-semibold tracking-wide text-zinc-800">
        {label}
      </div>
      {subtitle ? (
        <div className="mt-1 text-center text-xs text-zinc-500">{subtitle}</div>
      ) : null}
    </div>
  );
}

export function ScoreCards({ result }: { result: AnalyzeResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <ScoreRing
        label="Overall"
        score={result.overallScore}
        subtitle="Average of all"
      />
      <ScoreRing label="SEO" score={result.seo.score} subtitle="Search engines" />
      <ScoreRing
        label="AEO"
        score={result.aeo.score}
        subtitle="Answer engines"
      />
      <ScoreRing
        label="GEO"
        score={result.geo.score}
        subtitle="Generative engines"
      />
    </div>
  );
}
