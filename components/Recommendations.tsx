import type { AnalyzeResult } from "@/lib/types";

type Category = "SEO" | "AEO" | "GEO" | "SPD";

const CATEGORY_META: Record<
  Category,
  { label: string; rail: string; chip: string; badge: string; dot: string }
> = {
  SEO: {
    label: "SEO",
    rail: "bg-teal-500",
    chip: "bg-teal-100 text-teal-800",
    badge: "text-teal-700",
    dot: "bg-teal-500",
  },
  AEO: {
    label: "AEO",
    rail: "bg-cyan-500",
    chip: "bg-cyan-100 text-cyan-800",
    badge: "text-cyan-700",
    dot: "bg-cyan-500",
  },
  GEO: {
    label: "GEO",
    rail: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800",
    badge: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  SPD: {
    label: "Speed",
    rail: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800",
    badge: "text-amber-700",
    dot: "bg-amber-500",
  },
};

/**
 * Parse a tip into its category + body. Robust to several formats so malformed
 * AI output never shows raw (e.g. "SEO: foo -> action: bar" -> SEO / "bar"):
 *   "[SEO] Add a title"
 *   "SEO: Add a title"
 *   "SEO: Missing title -> action: Add a title"
 */
function splitTip(tip: string): { category: Category | null; body: string } {
  const s = tip.trim();

  // Leading "[TAG]" prefix (canonical)
  const bracket = s.match(/^\[(SEO|AEO|GEO|SPD)\]\s*(.*)$/i);
  if (bracket) {
    return {
      category: bracket[1].toUpperCase() as Category,
      body: cleanBody(bracket[2]),
    };
  }

  // "TAG:" prefix
  const colon = s.match(/^(SEO|AEO|GEO|SPD)[:\-]\s*(.*)$/i);
  if (colon) {
    return {
      category: colon[1].toUpperCase() as Category,
      body: cleanBody(colon[2]),
    };
  }

  // Inline tag anywhere
  const inline = s.match(/\[(SEO|AEO|GEO|SPD)\]/i);
  if (inline) {
    return {
      category: inline[1].toUpperCase() as Category,
      body: cleanBody(s.replace(/\[(SEO|AEO|GEO|SPD)\]\s*/gi, "")),
    };
  }

  return { category: null, body: cleanBody(s) };
}

/** Keep only the actionable part of a body and strip noise. */
function cleanBody(body: string): string {
  let s = body.trim();
  // "issue -> action: fix" or "issue -> fix" -> keep the part after the arrow
  const arrow = s.split(/\s*->\s*|—\s*|→\s*/i);
  if (arrow.length >= 2) {
    const after = arrow[arrow.length - 1]
      .trim()
      .replace(/^action\s*:\s*/i, "");
    if (after.length > 12) s = after;
  }
  return s
    .replace(/^\*\*?|\*\*?$/g, "")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();
}

function ruleFallbackTips(result: AnalyzeResult): string[] {
  return [
    ...result.seo.recommendations.map((t) => `[SEO] ${t}`),
    ...result.aeo.recommendations.map((t) => `[AEO] ${t}`),
    ...result.geo.recommendations.map((t) => `[GEO] ${t}`),
    ...result.speed.recommendations.map((t) => `[SPD] ${t}`),
  ].slice(0, 8);
}

function CategoryCard({
  category,
  tips,
}: {
  category: Category;
  tips: string[];
}) {
  const meta = CATEGORY_META[category];

  return (
    <div className="glass-panel relative flex flex-col overflow-hidden rounded-2xl">
      <span
        className={`absolute inset-y-0 left-0 w-1 ${meta.rail}`}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3 pl-6">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
          <h4 className="font-display text-base font-semibold text-slate-900">
            {meta.label}
          </h4>
        </div>
        <span
          className={`rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold ${meta.badge} ring-1 ring-slate-200/80`}
        >
          {tips.length} {tips.length === 1 ? "tip" : "tips"}
        </span>
      </div>
      <ul className="space-y-2 px-5 pb-5 pl-6">
        {tips.map((tip, i) => {
          const { body } = splitTip(tip);
          return (
            <li
              key={`${category}-${i}-${tip.slice(0, 16)}`}
              className="flex gap-2.5 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-slate-100"
            >
              <span
                className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`}
                aria-hidden
              />
              <p className="text-sm leading-relaxed text-slate-700">{body}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Recommendations({ result }: { result: AnalyzeResult }) {
  const allTips =
    result.aiRecommendations.length > 0
      ? result.aiRecommendations
      : ruleFallbackTips(result);

  const groups: Record<Category, string[]> = {
    SEO: [],
    AEO: [],
    GEO: [],
    SPD: [],
  };
  const untagged: string[] = [];

  for (const tip of allTips) {
    const { category, body } = splitTip(tip);
    if (category) {
      groups[category].push(body);
    } else {
      untagged.push(body);
    }
  }

  // Spread any untagged tips evenly across the four categories
  if (untagged.length > 0) {
    const order: Category[] = ["SEO", "AEO", "GEO", "SPD"];
    untagged.forEach((body, i) => {
      groups[order[i % order.length]].push(body);
    });
  }

  const orderedCategories: Category[] = ["SEO", "AEO", "GEO", "SPD"];
  const visibleGroups = orderedCategories
    .map((c) => ({ category: c, tips: groups[c] }))
    .filter((g) => g.tips.length > 0);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5 sm:p-6 shadow-sm">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-200/25 blur-3xl"
        aria-hidden
      />
      <div className="relative mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900">
            How to improve
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Prioritized fixes grouped by audit area
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

      {visibleGroups.length > 0 ? (
        <div className="relative grid gap-4 sm:grid-cols-2">
          {visibleGroups.map(({ category, tips }) => (
            <CategoryCard
              key={category}
              category={category}
              tips={tips.slice(0, 4)}
            />
          ))}
        </div>
      ) : (
        <p className="relative text-sm text-slate-600">
          Looks solid. Keep content fresh and re-audit after major site changes.
        </p>
      )}
    </section>
  );
}
