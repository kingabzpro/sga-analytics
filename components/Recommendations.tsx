import type { AnalyzeResult } from "@/lib/types";

function tagClass(tip: string) {
  if (/\[SEO\]/i.test(tip)) return "bg-teal-100 text-teal-800";
  if (/\[AEO\]/i.test(tip)) return "bg-cyan-100 text-cyan-800";
  if (/\[GEO\]/i.test(tip)) return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-600";
}

function splitTip(tip: string) {
  const m = tip.match(/^\[(SEO|AEO|GEO)\]\s*(.*)$/i);
  if (m) return { tag: m[1].toUpperCase(), body: m[2] };
  return { tag: null as string | null, body: tip };
}

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
    <section className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5 sm:p-6 shadow-sm">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-200/25 blur-3xl"
        aria-hidden
      />
      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900">
            How to improve
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Prioritized fixes based on your audit
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800 ring-1 ring-teal-100">
          {result.aiSource === "huggingface" ? "AI + rules" : "Rule-based"}
        </span>
      </div>

      {result.aiSummary ? (
        <p className="relative mb-5 max-w-3xl text-sm leading-relaxed text-slate-700 sm:text-[15px]">
          {result.aiSummary}
        </p>
      ) : null}

      <ol className="relative space-y-2.5">
        {tips.map((tip, i) => {
          const { tag, body } = splitTip(tip);
          return (
            <li
              key={`${i}-${tip.slice(0, 24)}`}
              className="flex gap-3 rounded-xl bg-white/90 px-3.5 py-3 ring-1 ring-teal-50/90"
            >
              <span className="font-mono-nums flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                {tag ? (
                  <span
                    className={`mb-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${tagClass(tip)}`}
                  >
                    {tag}
                  </span>
                ) : null}
                <p className="text-sm leading-relaxed text-slate-700">{body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
