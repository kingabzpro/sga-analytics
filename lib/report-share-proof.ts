import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AnalyzeResult } from "./types";

const PROOF_MAX_AGE_SECONDS = 6 * 60 * 60;
export const MAX_SHARED_REPORT_BYTES = 512_000;

function proofSecret(): string | null {
  return process.env.REPORT_SHARE_SECRET ?? process.env.CLERK_SECRET_KEY ?? null;
}

function serializedReport(result: AnalyzeResult): string {
  return JSON.stringify(result);
}

function signatureFor(result: AnalyzeResult, issuedAt: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${issuedAt}.${serializedReport(result)}`)
    .digest("base64url");
}

/** Proves that a report payload came from SGA's analyzer rather than an
 * arbitrary client. The proof is short-lived; the resulting share lasts 24h. */
export function createReportShareProof(result: AnalyzeResult): string | null {
  const secret = proofSecret();
  if (!secret) return null;
  const issuedAt = Math.floor(Date.now() / 1000);
  return `${issuedAt}.${signatureFor(result, issuedAt, secret)}`;
}

export function verifyReportShareProof(
  result: AnalyzeResult,
  proof: string
): boolean {
  const secret = proofSecret();
  if (!secret) return false;

  const [issuedRaw, supplied] = proof.split(".");
  const issuedAt = Number(issuedRaw);
  if (!Number.isInteger(issuedAt) || !supplied) return false;

  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + 300 || now - issuedAt > PROOF_MAX_AGE_SECONDS) return false;

  const expected = signatureFor(result, issuedAt, secret);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

/** Replays of one valid proof resolve to the same row instead of creating
 * unlimited database records. */
export function reportIdFromProof(proof: string): string {
  return createHash("sha256").update(proof).digest("base64url").slice(0, 22);
}

function isCategory(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const category = value as Record<string, unknown>;
  return (
    typeof category.score === "number" &&
    category.score >= 0 &&
    category.score <= 100 &&
    Array.isArray(category.checks) &&
    Array.isArray(category.recommendations)
  );
}

/** Runtime boundary validation before a client payload reaches Postgres. The
 * HMAC is the authenticity check; this guard keeps malformed data out. */
export function isAnalyzeResult(value: unknown): value is AnalyzeResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const signals = result.signals as Record<string, unknown> | undefined;
  const domainRating = result.domainRating as Record<string, unknown> | undefined;
  const citability = result.citability as Record<string, unknown> | undefined;

  return (
    typeof result.url === "string" &&
    typeof result.finalUrl === "string" &&
    typeof result.analyzedAt === "string" &&
    Number.isFinite(Date.parse(result.analyzedAt)) &&
    typeof result.overallScore === "number" &&
    result.overallScore >= 0 &&
    result.overallScore <= 100 &&
    isCategory(result.seo) &&
    isCategory(result.aeo) &&
    isCategory(result.geo) &&
    isCategory(result.speed) &&
    isCategory(result.technical) &&
    Boolean(signals) &&
    typeof signals?.title === "string" &&
    typeof signals?.metaDescription === "string" &&
    Boolean(domainRating) &&
    typeof domainRating?.score === "number" &&
    Boolean(citability) &&
    typeof citability?.score === "number" &&
    Array.isArray(result.aiRecommendations)
  );
}
