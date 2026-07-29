import { fetchPageBundle } from "./fetch-page";
import { extractSignals } from "./extract";
import { scoreSeo } from "./score-seo";
import { scoreAeo } from "./score-aeo";
import { scoreGeo } from "./score-geo";
import { scoreSpeed } from "./score-speed";
import { generateAiAdvice } from "./ai-recommendations";
import { getDomainRating } from "./domain-rating";
import { getPsiMetrics } from "./psi";
import type { AnalyzeResult } from "./types";
import { clamp } from "./score-utils";

/**
 * Weights for the on-page Overall score (sum = 100). SEO is weighted highest
 * because it is the broadest, most impactful on-page dimension; Speed gets the
 * least because it overlaps with technical-SEO concerns already covered. Tune
 * freely — the Domain Rating is intentionally excluded (it's off-page and shown
 * as its own metric).
 */
export const OVERALL_WEIGHTS = {
  seo: 35,
  aeo: 25,
  geo: 20,
  speed: 20,
} as const;

function weightedOverall(
  scores: { seo: number; aeo: number; geo: number; speed: number }
): number {
  const w = OVERALL_WEIGHTS;
  const total = w.seo + w.aeo + w.geo + w.speed;
  const blended =
    (scores.seo * w.seo +
      scores.aeo * w.aeo +
      scores.geo * w.geo +
      scores.speed * w.speed) /
    total;
  return clamp(Math.round(blended));
}

export async function analyzeUrl(rawUrl: string): Promise<AnalyzeResult> {
  const page = await fetchPageBundle(rawUrl);
  const signals = extractSignals(page);

  const seo = scoreSeo(signals);
  const aeo = scoreAeo(signals);
  const geo = scoreGeo(signals);

  const compactSignals: AnalyzeResult["signals"] = {
    title: signals.title,
    metaDescription: signals.metaDescription,
    wordCount: signals.wordCount,
    jsonLdTypes: signals.jsonLdTypes,
    hasRobotsTxt: Boolean(signals.robotsTxt),
    hasSitemap: signals.sitemapFound,
    hasLlmsTxt: signals.llmsTxtFound,
    aiBots: signals.aiBots,
    loadTimeMs: signals.loadTimeMs,
    htmlSizeBytes: signals.html.length,
  };

  let host = "example.com";
  try {
    host = new URL(signals.finalUrl).hostname;
  } catch {
    /* keep fallback */
  }

  // Fetch real Core Web Vitals (PSI) + off-page authority (Open PageRank) in
  // parallel — both are independent of each other and of scoring. Speed and the
  // Overall score are computed AFTER this, because Speed uses the PSI metrics
  // when available and the AI tips reference the final scores. AI advice runs
  // last since it depends on the scored result.
  const [psi, domainRating] = await Promise.all([
    getPsiMetrics(signals.finalUrl),
    getDomainRating(host, { signals }),
  ]);

  const speed = scoreSpeed(signals, psi);
  const overallScore = weightedOverall({
    seo: seo.score,
    aeo: aeo.score,
    geo: geo.score,
    speed: speed.score,
  });

  const ai = await generateAiAdvice({
    url: signals.finalUrl,
    overallScore,
    seo,
    aeo,
    geo,
    speed,
    signals: compactSignals,
  });

  return {
    url: signals.url,
    finalUrl: signals.finalUrl,
    analyzedAt: new Date().toISOString(),
    overallScore,
    seo,
    aeo,
    geo,
    speed,
    signals: compactSignals,
    domainRating,
    psiMetrics: psi,
    aiSummary: ai.summary,
    aiRecommendations: ai.recommendations,
    aiSource: ai.source,
  };
}
