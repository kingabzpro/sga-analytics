import type { CheckResult, CategoryScore } from "./types";

/**
 * Per-check credit in 0..1. A check earns full credit when it passes; 0 when it
 * fails; and partial credit (the optional `partialScore`) for a "nearly good"
 * signal. Omitting `partialScore` falls back to the binary `passed` flag, so all
 * existing checks keep working unchanged.
 */
export function checkCredit(c: CheckResult): number {
  const p = c.partialScore;
  if (typeof p === "number" && Number.isFinite(p)) {
    return clamp01(p);
  }
  return c.passed ? 1 : 0;
}

export function scoreFromChecks(checks: CheckResult[]): number {
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  if (totalWeight <= 0) return 0;
  const earned = checks.reduce((s, c) => s + c.weight * checkCredit(c), 0);
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

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * A piecewise-linear ramp returning 0..1.
 * - value <= edge[0]      -> 0
 * - value >= edge[1]      -> 1
 * - in between             -> linear interpolation
 * Use [low, high] for "higher is better". For "lower is better" (e.g. load
 * time), pass reversed edges or use rampDown.
 */
export function ramp(value: number, edge: [number, number]): number {
  const [low, high] = edge[0] <= edge[1] ? edge : [edge[1], edge[0]];
  if (value <= low) return 0;
  if (value >= high) return 1;
  return (value - low) / (high - low);
}

/** Inverse ramp: full credit at/below `ideal`, none at/beyond `bad`. */
export function rampDown(value: number, ideal: number, bad: number): number {
  return 1 - ramp(value, [ideal, bad]);
}
