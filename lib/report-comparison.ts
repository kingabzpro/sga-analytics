import type { AnalyzeResult, CategoryScore } from "./types";

const CATEGORY_KEYS = ["seo", "aeo", "geo", "speed", "technical"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

export type ScoreDelta = {
  key: "overall" | CategoryKey;
  label: string;
  previous: number;
  current: number;
  delta: number;
};

export type CheckChange = {
  id: string;
  category: string;
  label: string;
};

export type ReportComparison = {
  scores: ScoreDelta[];
  fixed: CheckChange[];
  introduced: CheckChange[];
  unresolved: CheckChange[];
};

function checkChanges(
  previous: CategoryScore,
  current: CategoryScore,
  category: string,
  mode: "fixed" | "introduced" | "unresolved"
): CheckChange[] {
  const previousById = new Map(previous.checks.map((check) => [check.id, check]));
  return current.checks.flatMap((check) => {
    const before = previousById.get(check.id);
    if (!before) return [];
    const changed =
      mode === "fixed"
        ? !before.passed && check.passed
        : mode === "introduced"
          ? before.passed && !check.passed
          : !before.passed && !check.passed;
    return changed ? [{ id: `${category}-${check.id}`, category, label: check.label }] : [];
  });
}

export function compareReports(
  previous: AnalyzeResult,
  current: AnalyzeResult
): ReportComparison {
  const scores: ScoreDelta[] = [
    {
      key: "overall",
      label: "Overall",
      previous: previous.overallScore,
      current: current.overallScore,
      delta: current.overallScore - previous.overallScore,
    },
    ...CATEGORY_KEYS.map((key) => ({
      key,
      label: key === "technical" ? "Technical" : key.toUpperCase(),
      previous: previous[key].score,
      current: current[key].score,
      delta: current[key].score - previous[key].score,
    })),
  ];

  const collect = (mode: "fixed" | "introduced" | "unresolved") =>
    CATEGORY_KEYS.flatMap((key) =>
      checkChanges(previous[key], current[key], key.toUpperCase(), mode)
    );

  return {
    scores,
    fixed: collect("fixed"),
    introduced: collect("introduced"),
    unresolved: collect("unresolved"),
  };
}
