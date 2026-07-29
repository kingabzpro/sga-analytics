import { fetchPageBundle } from "./fetch-page";
import { extractSignals } from "./extract";
import { scoreSeo } from "./score-seo";
import { scoreAeo } from "./score-aeo";
import { scoreGeo } from "./score-geo";
import { scoreSpeed } from "./score-speed";
import { scoreTechnical } from "./score-technical";
import { checkLinks } from "./check-links";
import { generateAiAdvice, generateCitabilityProbe } from "./ai-recommendations";
import { getDomainRating } from "./domain-rating";
import { getPsiMetrics } from "./psi";
import type { AnalyzeResult } from "./types";
import { clamp } from "./score-utils";

/**
 * Weights for the on-page Overall score (sum = 100). SEO is weighted highest
 * because it is the broadest, most impactful on-page dimension; Speed and
 * Technical get less because they overlap with technical-SEO concerns already
 * covered. Tune freely — the Domain Rating is intentionally excluded (it's
 * off-page and shown as its own metric).
 */
export const OVERALL_WEIGHTS = {
  seo: 30,
  aeo: 22,
  geo: 18,
  speed: 15,
  technical: 15,
} as const;

function weightedOverall(scores: {
  seo: number;
  aeo: number;
  geo: number;
  speed: number;
  technical: number;
}): number {
  const w = OVERALL_WEIGHTS;
  const total = w.seo + w.aeo + w.geo + w.speed + w.technical;
  const blended =
    (scores.seo * w.seo +
      scores.aeo * w.aeo +
      scores.geo * w.geo +
      scores.speed * w.speed +
      scores.technical * w.technical) /
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

  // Run the independent external/async work in parallel: PSI Core Web Vitals,
  // Open PageRank authority, and the broken-link HEAD probe. None depend on the
  // scores, so running them together adds only the latency of the slowest. The
  // category scores (Speed from PSI, Technical from the link probe) and the
  // weighted Overall are then computed, and AI advice runs last because its
  // tips reference the final scores.
  const [psi, domainRating, brokenLinks] = await Promise.all([
    getPsiMetrics(signals.finalUrl),
    getDomainRating(host, { signals }),
    checkLinks(signals),
  ]);

  const speed = scoreSpeed(signals, psi);
  const technical = scoreTechnical({ signals, brokenLinks });
  const overallScore = weightedOverall({
    seo: seo.score,
    aeo: aeo.score,
    geo: geo.score,
    speed: speed.score,
    technical: technical.score,
  });

  // AI advice + the citability probe both depend on the final scores, so they
  // run together after the Overall is known. They're independent of each other,
  // so running them in parallel adds only the latency of the slower.
  const [ai, citability] = await Promise.all([
    generateAiAdvice({
      url: signals.finalUrl,
      overallScore,
      seo,
      aeo,
      geo,
      speed,
      technical,
      signals: compactSignals,
    }),
    generateCitabilityProbe({ signals, geo, aeo }),
  ]);

  return {
    url: signals.url,
    finalUrl: signals.finalUrl,
    analyzedAt: new Date().toISOString(),
    overallScore,
    seo,
    aeo,
    geo,
    speed,
    technical,
    signals: compactSignals,
    domainRating,
    psiMetrics: psi,
    citability,
    aiSummary: ai.summary,
    aiRecommendations: ai.recommendations,
    aiSource: ai.source,
  };
}
