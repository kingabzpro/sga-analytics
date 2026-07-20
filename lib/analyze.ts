import { fetchPageBundle } from "./fetch-page";
import { extractSignals } from "./extract";
import { scoreSeo } from "./score-seo";
import { scoreAeo } from "./score-aeo";
import { scoreGeo } from "./score-geo";
import { generateAiAdvice } from "./ai-recommendations";
import type { AnalyzeResult } from "./types";
import { clamp } from "./score-utils";

export async function analyzeUrl(rawUrl: string): Promise<AnalyzeResult> {
  const page = await fetchPageBundle(rawUrl);
  const signals = extractSignals(page);

  const seo = scoreSeo(signals);
  const aeo = scoreAeo(signals);
  const geo = scoreGeo(signals);
  const overallScore = clamp(
    Math.round((seo.score + aeo.score + geo.score) / 3)
  );

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
  };

  const ai = await generateAiAdvice({
    url: signals.finalUrl,
    overallScore,
    seo,
    aeo,
    geo,
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
    signals: compactSignals,
    aiSummary: ai.summary,
    aiRecommendations: ai.recommendations,
    aiSource: ai.source,
  };
}
