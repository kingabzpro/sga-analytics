import type { AnalyzeResult } from "@/lib/types";

export function Recommendations({ result }: { result: AnalyzeResult }) {
  const tips =
    result.aiRecommendations.length > 0
      ? result.aiRecommendations
      : [
          ...result.seo.recommendations.map((t) => `[SEO] ${t}`),
          ...result.aeo.recommendations.map((t) => `[AEO] ${t}`),
          ...result.geo.recommendations.map((t) => `[GEO] ${t}`),
        ].slice(0, 8);

  return (
    <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900">
          How to improve
        </h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-indigo-600 ring-1 ring-indigo-100">
          {result.aiSource === "huggingface" ? "AI + rules" : "Rule-based"}
        </span>
      </div>

      {result.aiSummary ? (
        <p className="mb-4 text-sm leading-relaxed text-zinc-700">
          {result.aiSummary}
        </p>
      ) : null}

      <ol className="space-y-2.5">
        {tips.map((tip, i) => (
          <li
            key={`${i}-${tip.slice(0, 24)}`}
            className="flex gap-3 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-indigo-50"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed text-zinc-700">{tip}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
