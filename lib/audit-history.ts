import "server-only";

import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { cacheKey } from "./cache";
import type {
  AnalyzeResult,
  AuditHistoryEntry,
  AuditHistorySummary,
} from "./types";

export const AUDIT_HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_AUDIT_HISTORY_ENTRIES = 20;
const HISTORY_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

type AuditHistoryRow = {
  id: string;
  payload: AnalyzeResult;
  analyzed_at: string | Date;
  created_at: string | Date;
};

export type RecordedAudit = {
  entry: AuditHistoryEntry;
  previousResult: AnalyzeResult | null;
};

export class AuditHistoryUnavailableError extends Error {
  constructor() {
    super("Audit history storage is not configured.");
    this.name = "AuditHistoryUnavailableError";
  }
}

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;
let schemaPromise: Promise<void> | null = null;

function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

function historyId(
  ownerUserId: string,
  canonicalUrl: string,
  analyzedAt: string
): string {
  return createHash("sha256")
    .update(`${ownerUserId}\0${canonicalUrl}\0${analyzedAt}`)
    .digest("base64url")
    .slice(0, 22);
}

function hostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "Untitled page";
  }
}

function summaryFromRow(row: AuditHistoryRow): AuditHistorySummary {
  const result = row.payload;
  return {
    id: row.id,
    url: result.finalUrl,
    title: result.signals.title || hostname(result.finalUrl),
    analyzedAt: toIso(row.analyzed_at),
    createdAt: toIso(row.created_at),
    overallScore: result.overallScore,
    seoScore: result.seo.score,
    aeoScore: result.aeo.score,
    geoScore: result.geo.score,
    speedScore: result.speed.score,
    technicalScore: result.technical.score,
  };
}

function entryFromRow(row: AuditHistoryRow): AuditHistoryEntry {
  return { ...summaryFromRow(row), result: row.payload };
}

function ensureSchema(): Promise<void> {
  if (!sql) return Promise.reject(new AuditHistoryUnavailableError());
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS audit_history (
          id text PRIMARY KEY,
          owner_user_id text NOT NULL,
          canonical_url text NOT NULL,
          payload jsonb NOT NULL,
          analyzed_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS audit_history_owner_date_idx
        ON audit_history (owner_user_id, analyzed_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS audit_history_owner_url_date_idx
        ON audit_history (owner_user_id, canonical_url, analyzed_at DESC)
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export function isAuditHistoryConfigured(): boolean {
  return Boolean(sql);
}

export async function recordAuditHistory(
  ownerUserId: string,
  result: AnalyzeResult
): Promise<RecordedAudit> {
  if (!sql) throw new AuditHistoryUnavailableError();
  await ensureSchema();

  const canonicalUrl = cacheKey(result.finalUrl);
  const id = historyId(ownerUserId, canonicalUrl, result.analyzedAt);
  const analyzedAt = new Date(result.analyzedAt).toISOString();
  const payload = JSON.stringify(result);

  const previousRows = (await sql`
    SELECT id, payload, analyzed_at, created_at
    FROM audit_history
    WHERE owner_user_id = ${ownerUserId}
      AND canonical_url = ${canonicalUrl}
      AND id <> ${id}
      AND analyzed_at >= now() - interval '30 days'
    ORDER BY analyzed_at DESC
    LIMIT 1
  `) as AuditHistoryRow[];

  await sql`
    INSERT INTO audit_history (
      id, owner_user_id, canonical_url, payload, analyzed_at, created_at
    )
    VALUES (
      ${id}, ${ownerUserId}, ${canonicalUrl}, ${payload}::jsonb,
      ${analyzedAt}, now()
    )
    ON CONFLICT (id) DO NOTHING
  `;

  const storedRows = (await sql`
    SELECT id, payload, analyzed_at, created_at
    FROM audit_history
    WHERE id = ${id} AND owner_user_id = ${ownerUserId}
    LIMIT 1
  `) as AuditHistoryRow[];
  const stored = storedRows[0];
  if (!stored) throw new Error("Audit history entry was not stored.");

  await sql`
    DELETE FROM audit_history
    WHERE owner_user_id = ${ownerUserId}
      AND (
        analyzed_at < now() - interval '30 days'
        OR id NOT IN (
          SELECT id FROM audit_history
          WHERE owner_user_id = ${ownerUserId}
          ORDER BY analyzed_at DESC
          LIMIT ${MAX_AUDIT_HISTORY_ENTRIES}
        )
      )
  `;

  return {
    entry: entryFromRow(stored),
    previousResult: previousRows[0]?.payload ?? null,
  };
}

export async function listAuditHistory(
  ownerUserId: string
): Promise<AuditHistorySummary[]> {
  if (!sql) throw new AuditHistoryUnavailableError();
  await ensureSchema();

  const rows = (await sql`
    SELECT id, payload, analyzed_at, created_at
    FROM audit_history
    WHERE owner_user_id = ${ownerUserId}
      AND analyzed_at >= now() - interval '30 days'
    ORDER BY analyzed_at DESC
    LIMIT ${MAX_AUDIT_HISTORY_ENTRIES}
  `) as AuditHistoryRow[];

  return rows.map(summaryFromRow);
}

export async function getAuditHistoryEntry(
  ownerUserId: string,
  id: string
): Promise<AuditHistoryEntry | null> {
  if (!sql) throw new AuditHistoryUnavailableError();
  if (!HISTORY_ID_PATTERN.test(id)) return null;
  await ensureSchema();

  const rows = (await sql`
    SELECT id, payload, analyzed_at, created_at
    FROM audit_history
    WHERE id = ${id}
      AND owner_user_id = ${ownerUserId}
      AND analyzed_at >= now() - interval '30 days'
    LIMIT 1
  `) as AuditHistoryRow[];

  return rows[0] ? entryFromRow(rows[0]) : null;
}
