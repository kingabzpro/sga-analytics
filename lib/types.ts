export type CheckResult = {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  detail: string;
};

export type CategoryScore = {
  score: number;
  checks: CheckResult[];
  recommendations: string[];
};

export type PageSignals = {
  url: string;
  finalUrl: string;
  statusCode: number;
  https: boolean;
  title: string;
  metaDescription: string;
  canonical: string | null;
  viewport: string | null;
  robotsMeta: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  headings: { level: number; text: string }[];
  images: { src: string; alt: string | null }[];
  links: { href: string; text: string; internal: boolean }[];
  jsonLdTypes: string[];
  jsonLdRaw: unknown[];
  hasFaqSchema: boolean;
  hasHowToSchema: boolean;
  hasQaSchema: boolean;
  wordCount: number;
  firstParagraph: string;
  hasMain: boolean;
  hasArticle: boolean;
  hasHeader: boolean;
  hasAuthor: boolean;
  hasDate: boolean;
  dateDetail: string | null;
  html: string;
  bodyHtml: string;
  robotsTxt: string | null;
  robotsTxtUrl: string | null;
  sitemapFound: boolean;
  sitemapUrl: string | null;
  llmsTxtFound: boolean;
  llmsTxtUrl: string | null;
  aiBots: { name: string; allowed: boolean | null }[];
  loadTimeMs: number;
};

export type AnalyzeResult = {
  url: string;
  finalUrl: string;
  analyzedAt: string;
  overallScore: number;
  seo: CategoryScore;
  aeo: CategoryScore;
  geo: CategoryScore;
  signals: {
    title: string;
    metaDescription: string;
    wordCount: number;
    jsonLdTypes: string[];
    hasRobotsTxt: boolean;
    hasSitemap: boolean;
    hasLlmsTxt: boolean;
    aiBots: { name: string; allowed: boolean | null }[];
    loadTimeMs: number;
  };
  aiSummary: string | null;
  aiRecommendations: string[];
  aiSource: "huggingface" | "rules";
};

export type AnalyzeError = {
  error: string;
};
