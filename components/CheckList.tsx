import type { CategoryScore } from "@/lib/types";

export function CheckList({
  title,
  category,
}: {
  title: string;
  category: CategoryScore;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        <span className="text-sm font-medium tabular-nums text-zinc-500">
          {category.score}/100
        </span>
      </div>
      <ul className="space-y-2.5">
        {category.checks.map((check) => (
          <li
            key={check.id}
            className="flex gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5"
          >
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                check.passed ? "bg-emerald-500" : "bg-rose-500"
              }`}
              aria-hidden
            >
              {check.passed ? "✓" : "!"}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-800">
                {check.label}
              </div>
              <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                {check.detail}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
