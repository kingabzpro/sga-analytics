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

export type AnalyzeProgress = {
  stage: "fetch" | "score" | "speed" | "authority" | "links" | "ai" | "complete";
  message: string;
};

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

export async function analyzeUrl(
  rawUrl: string,
  options?: { onProgress?: (event: AnalyzeProgress) => void }
): Promise<AnalyzeResult> {
  const progress = options?.onProgress ?? (() => {});
  progress({ stage: "fetch", message: "Fetching the page and crawl files" });
  const page = await fetchPageBundle(rawUrl);
  progress({
    stage: "score",
    message:
      page.fetchSource === "reader"
        ? "Origin blocked direct access; protected-page content extracted"
        : "Page received directly; scoring on-page signals",
  });
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
    fetchSource: signals.fetchSource,
  };

  let host = "example.com";
  try {
    host = new URL(signals.finalUrl).hostname;
  } catch {
    /* keep fallback */
  }

  // Start every independent slow operation together. AI advice uses the
  // immediately available heuristic Speed/Technical scores; the final report
  // still replaces those category scores with provider/link-backed results.
  // This removes the old PSI-then-Mistral serial latency (~19s locally).
  const provisionalSpeed = scoreSpeed(signals);
  const provisionalTechnical = scoreTechnical({ signals, brokenLinks: [] });
  const provisionalOverall = weightedOverall({
    seo: seo.score,
    aeo: aeo.score,
    geo: geo.score,
    speed: provisionalSpeed.score,
    technical: provisionalTechnical.score,
  });

  const completed = <T>(
    promise: Promise<T>,
    event: AnalyzeProgress | ((value: T) => AnalyzeProgress)
  ): Promise<T> =>
    promise.then((value) => {
      progress(typeof event === "function" ? event(value) : event);
      return value;
    });

  const [psi, domainRating, brokenLinks, ai, citability] = await Promise.all([
    completed(getPsiMetrics(signals.finalUrl), (value) => ({
      stage: "speed",
      message: value
        ? `Performance data received from ${value.source === "crux" ? "CrUX" : "PageSpeed Insights"}`
        : "Performance provider unavailable; using on-page estimate",
    })),
    completed(getDomainRating(host, { signals }), (value) => ({
      stage: "authority",
      message:
        value.source === "ahrefs"
          ? "Domain Rating received from Ahrefs"
          : value.source === "openpagerank"
            ? "Domain authority received from Open PageRank"
          : "Authority provider unavailable; using labeled estimate",
    })),
    completed(checkLinks(signals), {
      stage: "links",
      message: "Outbound link checks finished",
    }),
    completed(
      generateAiAdvice({
        url: signals.finalUrl,
        overallScore: provisionalOverall,
        seo,
        aeo,
        geo,
        speed: provisionalSpeed,
        technical: provisionalTechnical,
        signals: compactSignals,
      }),
      (value) => ({
        stage: "ai",
        message:
          value.source === "mistral"
            ? "AI recommendations received from Mistral"
            : "Mistral unavailable; using rule recommendations",
      })
    ),
    completed(generateCitabilityProbe({ signals, geo, aeo }), (value) => ({
      stage: "ai",
      message:
        value.source === "mistral"
          ? "AI citability verdict received from Mistral"
          : "Mistral unavailable; using rule citability verdict",
    })),
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

  progress({ stage: "complete", message: "Report complete" });
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
