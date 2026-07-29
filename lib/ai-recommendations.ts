import { Mistral } from "@mistralai/mistralai";
import type { AnalyzeResult, CategoryScore } from "./types";

// AI tips via Mistral (`@mistralai/mistralai`). mistral-medium-latest answers a
// real audit prompt in ~5s with clean VERDICT/[TAG] output. Falls back to
// rule-based tips if no key is set or the call fails/slow — the AI text is an
// enhancement, never a blocker for the analysis itself.
const MODEL = "mistral-medium-latest";
const AI_TIMEOUT_MS = 20000;

export type AiAdvice = {
  summary: string | null;
  recommendations: string[];
  source: "mistral" | "rules";
};

function ruleFallback(
  seo: CategoryScore,
  aeo: CategoryScore,
  geo: CategoryScore,
  speed: CategoryScore,
  overall: number
): AiAdvice {
  const tips = [
    ...seo.recommendations.map((t) => `[SEO] ${t}`),
    ...aeo.recommendations.map((t) => `[AEO] ${t}`),
    ...geo.recommendations.map((t) => `[GEO] ${t}`),
    ...speed.recommendations.map((t) => `[SPD] ${t}`),
  ].slice(0, 8);

  return {
    summary: `Overall score ${overall}/100. Focus on the weakest areas first and ship quick technical wins before deeper content work.`,
    recommendations: tips.length
      ? tips
      : [
          "Looks solid. Keep content fresh and re-audit after major site changes.",
        ],
    source: "rules",
  };
}


/**
 * Normalize a single AI tip line into a clean `[TAG] body` string.
 * Handles the formats the model actually emits, not just the requested one:
 *   "[SEO] Add a title"              -> "[SEO] Add a title"
 *   "SEO: Add a title"               -> "[SEO] Add a title"
 *   "SEO: Missing title -> action: Add a title"  -> "[SEO] Add a title"
 *   "1. SEO: foo -> bar"             -> "[SEO] bar"
 * Returns null when the line isn't a usable tip (too short, or a template echo).
 */
function normalizeTip(line: string): string | null {
  let s = line.trim();

  // strip leading list markers / numbering
  s = s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/i, "");
  // strip a leading "fix:" prefix
  s = s.replace(/^fix:\s*/i, "");

  // Extract category tag: either "[SEO]" or "SEO:" at the start
  const tagMatch = s.match(/^\[?(SEO|AEO|GEO|SPD|DR)\]?\s*[:\-–]?\s*/i);
  let category: string | null = null;
  if (tagMatch) {
    category = tagMatch[1].toUpperCase();
    s = s.slice(tagMatch[0].length).trim();
  }

  // If the model wrote "issue -> action: fix" or "issue -> fix", keep only the
  // actionable part (after the arrow), which is the actual recommendation.
  const arrow = s.split(/\s*->\s*|—\s*|→\s*/i);
  if (arrow.length >= 2) {
    let after = arrow[arrow.length - 1].trim();
    after = after.replace(/^action\s*:\s*/i, "");
    if (after.length > 12) s = after;
  }

  // inline tag somewhere mid-line? hoist it to the front and remove inline
  const inlineTag = s.match(/\[(SEO|AEO|GEO|SPD|DR)\]/i);
  if (inlineTag) {
    category = inlineTag[1].toUpperCase();
    s = s.replace(/\[(SEO|AEO|GEO|SPD|DR)\]\s*/gi, "").trim();
  }

  // strip wrapping quotes / markdown bold
  s = s.replace(/^\*\*?|\*\*?$/g, "").replace(/^["'`]|["'`]$/g, "").trim();

  if (s.length < 12) return null;

  // Drop placeholder / template echoes
  if (
    /concrete fix|specific action|SEO\|AEO\|GEO|one (plain )?sentence|plain sentence|placeholder|<[^>]+>/i.test(
      s
    )
  ) {
    return null;
  }

  return category ? `[${category}] ${s}` : s;
}

function parseAiText(text: string): {
  summary: string;
  recommendations: string[];
} {
  const cleaned = text
    .replace(/\*\([^*]+\)\*/g, "")
    .replace(/^\s*\[Output\][^\n]*/gim, "")
    .trim();

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let summary = "";
  const recommendations: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const verdict = line.match(/^VERDICT:\s*(.+)$/i);
    if (verdict?.[1]) {
      summary = verdict[1].trim();
      continue;
    }

    const normalized = normalizeTip(line);
    if (normalized) {
      const key = normalized.toLowerCase().slice(0, 48);
      if (!seen.has(key)) {
        seen.add(key);
        recommendations.push(normalized);
      }
      continue;
    }

    if (
      !summary &&
      line.length > 24 &&
      !/^here'?s a thinking/i.test(line) &&
      !/^\d+\.\s+\*\*/.test(line)
    ) {
      summary = line.replace(/^#+\s*/, "").replace(/^\*\*?summary\*\*?:?\s*/i, "");
    }
  }

  if (!summary) {
    summary = lines.find((l) => l.length > 30)?.slice(0, 280) || "AI analysis complete.";
  }

  return {
    summary: summary.slice(0, 400),
    recommendations: recommendations.slice(0, 8),
  };
}

export async function generateAiAdvice(input: {
  url: string;
  overallScore: number;
  seo: CategoryScore;
  aeo: CategoryScore;
  geo: CategoryScore;
  speed: CategoryScore;
  signals: AnalyzeResult["signals"];
}): Promise<AiAdvice> {
  const fallback = ruleFallback(
    input.seo,
    input.aeo,
    input.geo,
    input.speed,
    input.overallScore
  );
  // Mistral needs its own key. The HF/Fireworks keys can't reach Mistral's API.
  const token = process.env.MISTRAL_API_KEY;

  if (!token) {
    return fallback;
  }

  const failed = [
    ...input.seo.checks
      .filter((c) => !c.passed)
      .map((c) => `SEO: ${c.label}: ${c.detail}`),
    ...input.aeo.checks
      .filter((c) => !c.passed)
      .map((c) => `AEO: ${c.label}: ${c.detail}`),
    ...input.geo.checks
      .filter((c) => !c.passed)
      .map((c) => `GEO: ${c.label}: ${c.detail}`),
    ...input.speed.checks
      .filter((c) => !c.passed)
      .map((c) => `SPD: ${c.label}: ${c.detail}`),
  ]
    .slice(0, 12)
    .join("\n");

  const prompt = `Website audit helper. URL: ${input.url}
Overall score: ${input.overallScore}/100 (SEO ${input.seo.score}, AEO ${input.aeo.score}, GEO ${input.geo.score}, SPD ${input.speed.score}).

Failed checks:
${failed || "None"}

Write the final answer ONLY in this exact shape:

VERDICT: <one plain sentence about the site>
1. [SEO] <specific action>
2. [AEO] <specific action>
3. [GEO] <specific action>
4. [SPD] <specific action>
5. [DR] <one specific action to grow backlinks / domain authority>

Rules: use real advice from the failed checks; do not copy placeholders; each line must be a complete actionable tip. No HTML.`;

  try {
    const client = new Mistral({ apiKey: token });

    const result = await Promise.race([
      client.chat.complete({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 800,
        temperature: 0.3,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), AI_TIMEOUT_MS)
      ),
    ]);

    const raw = result?.choices?.[0]?.message?.content;
    // content can be a string or an array of content parts; normalize to text
    const content =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw
              .map((p) =>
                typeof p === "string"
                  ? p
                  : "text" in p
                    ? (p.text ?? "")
                    : ""
              )
              .join("\n")
          : "";
    if (!content.trim()) return fallback;

    const parsed = parseAiText(content);
    const aiTips = parsed.recommendations.filter((t) => t.length > 20);

    // Prefer AI tips; pad with rule-based tips if the model was brief/truncated.
    // Dedupe case-insensitively by leading substring so we never show near-dupes.
    const merged: string[] = [...aiTips];
    const seenKeys = new Set(
      aiTips.map((t) => t.toLowerCase().replace(/\W+/g, " ").slice(0, 32))
    );
    for (const tip of fallback.recommendations) {
      if (merged.length >= 6) break;
      const key = tip.toLowerCase().replace(/\W+/g, " ").slice(0, 32);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        merged.push(tip);
      }
    }

    // Catch template echoes that slipped through (e.g. the model literally wrote
    // "<one sentence summarizing...>" instead of a real verdict).
    const summaryLooksBad =
      !parsed.summary ||
      /one (plain )?sentence|summari[sz]ing the site|concrete fix|specific action|SEO\|AEO|```html|<[^>]+>|placeholder/i.test(
        parsed.summary
      );

    return {
      summary: summaryLooksBad ? fallback.summary : parsed.summary,
      recommendations: merged.length > 0 ? merged : fallback.recommendations,
      source: "mistral",
    };
  } catch {
    return fallback;
  }
}
