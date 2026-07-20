import type { AnalyzeResult } from "@/lib/types";

function ringColor(score: number) {
  if (score >= 80) return "#0d9488";
  if (score >= 60) return "#0891b2";
  return "#e11d48";
}

function tint(score: number) {
  if (score >= 80) return "from-teal-50/90 to-white";
  if (score >= 60) return "from-cyan-50/90 to-white";
  return "from-rose-50/80 to-white";
}

function labelColor(score: number) {
  if (score >= 80) return "text-teal-700";
  if (score >= 60) return "text-cyan-700";
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
  const r = featured ? 40 : 34;
  const size = featured ? 108 : 92;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c;
  const cx = size / 2;

  return (
    <div
      className={`score-card flex flex-col items-center rounded-2xl bg-gradient-to-b p-4 sm:p-5 ${tint(score)}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={featured ? 9 : 8}
          />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={ringColor(score)}
            strokeWidth={featured ? 9 : 8}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono-nums font-semibold tracking-tight text-slate-900 ${
              featured ? "text-3xl" : "text-2xl"
            }`}
          >
            {score}
          </span>
        </div>
      </div>
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
    </div>
  );
}

export function ScoreCards({ result }: { result: AnalyzeResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <ScoreRing
        label="Overall"
        score={result.overallScore}
        subtitle="Average of all scores"
        featured
      />
      <ScoreRing
        label="SEO"
        score={result.seo.score}
        subtitle="Search engines"
      />
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
