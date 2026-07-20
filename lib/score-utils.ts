import type { CheckResult, CategoryScore } from "./types";

export function scoreFromChecks(checks: CheckResult[]): number {
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  if (totalWeight <= 0) return 0;
  const earned = checks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
  return Math.round((earned / totalWeight) * 100);
}

export function buildCategory(
  checks: CheckResult[],
  tipsForFailed: (check: CheckResult) => string
): CategoryScore {
  const score = scoreFromChecks(checks);
  const recommendations = checks
    .filter((c) => !c.passed)
    .map(tipsForFailed)
    .filter(Boolean);
  return { score, checks, recommendations };
}

export function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}
