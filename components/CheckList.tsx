import type { CategoryScore } from "@/lib/types";

const accents: Record<string, string> = {
  SEO: "border-t-indigo-500",
  AEO: "border-t-violet-500",
  GEO: "border-t-sky-500",
};

export function CheckList({
  title,
  category,
  kind = "SEO",
}: {
  title: string;
  category: CategoryScore;
  kind?: "SEO" | "AEO" | "GEO";
}) {
  const passed = category.checks.filter((c) => c.passed).length;
  const total = category.checks.length;

  return (
    <section
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
        <span className="font-mono-nums rounded-lg bg-slate-900 px-2.5 py-1 text-sm font-semibold text-white">
          {category.score}
        </span>
      </div>
      <ul className="space-y-2">
        {category.checks.map((check) => (
          <li
            key={check.id}
            className="flex gap-3 rounded-xl border border-slate-100 bg-white/80 px-3 py-2.5"
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
          </li>
        ))}
      </ul>
    </section>
  );
}
