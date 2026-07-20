import { InferenceClient } from "@huggingface/inference";
import type { AnalyzeResult, CategoryScore } from "./types";

const MODEL = "deepseek-ai/DeepSeek-V4-Flash";
const PROVIDER = "fireworks-ai" as const;
const AI_TIMEOUT_MS = 45000;

export type AiAdvice = {
  summary: string | null;
  recommendations: string[];
  source: "huggingface" | "rules";
};

function ruleFallback(
  seo: CategoryScore,
  aeo: CategoryScore,
  geo: CategoryScore,
  overall: number
): AiAdvice {
  const tips = [
    ...seo.recommendations.map((t) => `[SEO] ${t}`),
    ...aeo.recommendations.map((t) => `[AEO] ${t}`),
    ...geo.recommendations.map((t) => `[GEO] ${t}`),
  ].slice(0, 8);

  return {
    summary: `Overall score ${overall}/100. Focus on the weakest areas first and ship quick technical wins before deeper content work.`,
    recommendations: tips.length
      ? tips
      : [
          "Looks solid — keep content fresh and re-audit after major site changes.",
        ],
    source: "rules",
  };
}

function extractMessageText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const m = message as Record<string, unknown>;

  const fromContent = (raw: unknown): string => {
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) {
      return raw
        .map((part: unknown) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object" && "text" in part) {
            return String((part as { text?: string }).text || "");
          }
          return "";
        })
        .join("\n");
    }
    return "";
  };

  const content = fromContent(m.content).trim();
  if (content) return content;

  // Reasoning models may only populate reasoning_content
  const reasoning =
    typeof m.reasoning_content === "string" ? m.reasoning_content : "";
  if (!reasoning) return "";

  // Prefer the final draft after VERDICT / Output markers
  const markers = ["VERDICT:", "[Output]", "Output:", "Final answer:"];
  let bestIdx = -1;
  for (const marker of markers) {
    const idx = reasoning.lastIndexOf(marker);
    if (idx > bestIdx) bestIdx = idx;
  }
  if (bestIdx >= 0) return reasoning.slice(bestIdx).trim();

  return reasoning.trim();
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

  for (const line of lines) {
    const verdict = line.match(/^VERDICT:\s*(.+)$/i);
    if (verdict?.[1]) {
      summary = verdict[1].trim();
      continue;
    }

    const bullet = line.match(
      /^(?:[-*]|\d+[.)])\s*(?:fix:\s*)?(\[[A-Z]{3}\]\s*.+|[A-Z].+)$/i
    );
    if (bullet?.[1] && bullet[1].length > 12) {
      let tip = bullet[1].trim();
      tip = tip.replace(/^fix:\s*/i, "");
      if (!/^\[[A-Z]{3}\]/i.test(tip) && /\[[A-Z]{3}\]/i.test(tip)) {
        const tag = tip.match(/\[(SEO|AEO|GEO)\]/i)?.[0];
        if (tag) tip = `${tag.toUpperCase()} ${tip.replace(tag, "").trim()}`;
      }
      // Drop placeholder / template echoes
      if (
        /concrete fix|specific action|SEO\|AEO\|GEO|plain sentence|placeholder/i.test(
          tip
        )
      ) {
        continue;
      }
      recommendations.push(tip);
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

  if (recommendations.length === 0) {
    const tagged = cleaned.match(/\[[A-Z]{3}\][^\n.]+[.\n]/gi);
    if (tagged?.length) {
      recommendations.push(...tagged.map((t) => t.trim()).slice(0, 5));
    }
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
  signals: AnalyzeResult["signals"];
}): Promise<AiAdvice> {
  const fallback = ruleFallback(
    input.seo,
    input.aeo,
    input.geo,
    input.overallScore
  );
  // Fireworks key (fw_...) preferred; HF token also works via fireworks-ai provider
  const token =
    process.env.FIREWORKS_API_KEY ||
    process.env.HF_TOKEN ||
    process.env.HF_API_TOKEN;

  if (!token) {
    return fallback;
  }

  const failed = [
    ...input.seo.checks
      .filter((c) => !c.passed)
      .map((c) => `SEO: ${c.label} — ${c.detail}`),
    ...input.aeo.checks
      .filter((c) => !c.passed)
      .map((c) => `AEO: ${c.label} — ${c.detail}`),
    ...input.geo.checks
      .filter((c) => !c.passed)
      .map((c) => `GEO: ${c.label} — ${c.detail}`),
  ]
    .slice(0, 12)
    .join("\n");

  const prompt = `Website audit helper. URL: ${input.url}
Overall score: ${input.overallScore}/100 (SEO ${input.seo.score}, AEO ${input.aeo.score}, GEO ${input.geo.score}).

Failed checks:
${failed || "None"}

Write the final answer ONLY in this exact shape:

VERDICT: <one plain sentence about the site>
1. [SEO] <specific action>
2. [AEO] <specific action>
3. [GEO] <specific action>
4. [SEO] <specific action>
5. [GEO] <specific action>

Rules: use real advice from the failed checks; do not copy placeholders; each line must be a complete actionable tip. No HTML.`;

  try {
    const client = new InferenceClient(token);

    const result = await Promise.race([
      client.chatCompletion({
        provider: PROVIDER,
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), AI_TIMEOUT_MS)
      ),
    ]);

    const content = extractMessageText(result.choices?.[0]?.message);
    if (!content.trim()) return fallback;

    const parsed = parseAiText(content);
    const aiTips = parsed.recommendations.filter((t) => t.length > 20);

    // Prefer AI tips; pad with rule-based tips if the model was brief/truncated
    const merged: string[] = [...aiTips];
    for (const tip of fallback.recommendations) {
      if (merged.length >= 6) break;
      const key = tip.toLowerCase().slice(0, 40);
      if (!merged.some((m) => m.toLowerCase().includes(key.slice(0, 24)))) {
        merged.push(tip);
      }
    }

    const summaryLooksBad =
      !parsed.summary ||
      /one plain sentence|concrete fix|specific action|SEO\|AEO|```html/i.test(
        parsed.summary
      );

    return {
      summary: summaryLooksBad ? fallback.summary : parsed.summary,
      recommendations: merged.length > 0 ? merged : fallback.recommendations,
      source: "huggingface",
    };
  } catch {
    return fallback;
  }
}
