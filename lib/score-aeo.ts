import type { CategoryScore, CheckResult, PageSignals } from "./types";
import { buildCategory } from "./score-utils";

const QUESTION_RE =
  /^(\s*)(who|what|when|where|why|how|which|does|do|is|are|can|should|will)\b/i;

export function scoreAeo(signals: PageSignals): CategoryScore {
  const checks: CheckResult[] = [];

  checks.push({
    id: "faq-schema",
    label: "FAQ / HowTo / QA schema",
    passed: signals.hasFaqSchema || signals.hasHowToSchema || signals.hasQaSchema,
    weight: 18,
    detail: signals.hasFaqSchema
      ? "FAQ schema detected"
      : signals.hasHowToSchema
        ? "HowTo schema detected"
        : signals.hasQaSchema
          ? "QA schema detected"
          : "No FAQ, HowTo, or QAPage structured data",
  });

  const questionHeadings = signals.headings.filter(
    (h) => h.text.includes("?") || QUESTION_RE.test(h.text)
  );
  checks.push({
    id: "question-headings",
    label: "Question-style headings",
    passed: questionHeadings.length >= 1,
    weight: 14,
    detail:
      questionHeadings.length > 0
        ? `${questionHeadings.length} question-like heading(s)`
        : "No Who/What/How/Why-style headings found",
  });

  const answerLen = signals.firstParagraph.length;
  const conciseAnswer = answerLen >= 40 && answerLen <= 320;
  checks.push({
    id: "direct-answer",
    label: "Direct answer near top",
    passed: conciseAnswer,
    weight: 16,
    detail: answerLen
      ? `First substantial paragraph is ${answerLen} characters`
      : "No substantial opening paragraph found",
  });

  const listCount =
    (signals.html.match(/<ul[\s>]/gi) || []).length +
    (signals.html.match(/<ol[\s>]/gi) || []).length;
  const tableCount = (signals.html.match(/<table[\s>]/gi) || []).length;
  checks.push({
    id: "lists-tables",
    label: "Lists or tables (snippet-friendly)",
    passed: listCount + tableCount >= 1,
    weight: 12,
    detail: `${listCount} list(s), ${tableCount} table(s)`,
  });

  checks.push({
    id: "heading-outline",
    label: "Clear H2/H3 outline",
    passed: signals.h2.length >= 2 || (signals.h2.length >= 1 && signals.h3.length >= 1),
    weight: 14,
    detail: `${signals.h2.length} H2, ${signals.h3.length} H3`,
  });

  checks.push({
    id: "author-signal",
    label: "Author / byline signal",
    passed: signals.hasAuthor,
    weight: 10,
    detail: signals.hasAuthor
      ? "Author or byline signal detected"
      : "No author meta, byline, or Person schema found",
  });

  checks.push({
    id: "semantic-content",
    label: "Semantic content container",
    passed: signals.hasMain || signals.hasArticle,
    weight: 8,
    detail: signals.hasMain
      ? "<main> present"
      : signals.hasArticle
        ? "<article> present"
        : "No <main> or <article> landmark",
  });

  checks.push({
    id: "enough-depth",
    label: "Answer depth (word count)",
    passed: signals.wordCount >= 300,
    weight: 8,
    detail: `${signals.wordCount} words (aim for 300+ for answer engines)`,
  });

  return buildCategory(checks, (c) => {
    switch (c.id) {
      case "faq-schema":
        return "Add FAQPage or HowTo JSON-LD so answer engines can extract Q&A cleanly.";
      case "question-headings":
        return "Use natural-language question headings (e.g. “How does X work?”).";
      case "direct-answer":
        return "Start with a concise 40–300 character answer paragraph before deep detail.";
      case "lists-tables":
        return "Structure key facts as bullet lists or tables for snippet extraction.";
      case "heading-outline":
        return "Add a clear H2/H3 outline that mirrors user questions and subtopics.";
      case "author-signal":
        return "Show a clear author byline and author meta/schema for trust.";
      case "semantic-content":
        return "Wrap primary content in <main> or <article> for clearer extraction.";
      case "enough-depth":
        return "Expand the page with substantive answers (300+ words) without fluff.";
      default:
        return `Improve: ${c.label}`;
    }
  });
}
