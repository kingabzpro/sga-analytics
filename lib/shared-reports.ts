import "server-only";

import { neon } from "@neondatabase/serverless";
import type { AnalyzeResult } from "./types";

export const SHARED_REPORT_TTL_MS = 24 * 60 * 60 * 1000;
const REPORT_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

type SharedReportRow = {
  id: string;
  payload: AnalyzeResult;
  created_at: string | Date;
  expires_at: string | Date;
};

export type SharedReport = {
  id: string;
  result: AnalyzeResult;
  createdAt: string;
  expiresAt: string;
};

export type SharedReportLookup =
  | { status: "active"; report: SharedReport }
  | { status: "expired" | "missing"; report: null };

export class ReportStorageUnavailableError extends Error {
  constructor() {
    super("Shared report storage is not configured.");
    this.name = "ReportStorageUnavailableError";
  }
}

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;
let schemaPromise: Promise<void> | null = null;

function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

function ensureSchema(): Promise<void> {
  if (!sql) return Promise.reject(new ReportStorageUnavailableError());
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS shared_reports (
          id text PRIMARY KEY,
          payload jsonb NOT NULL,
          owner_user_id text,
          created_at timestamptz NOT NULL,
          expires_at timestamptz NOT NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS shared_reports_expires_at_idx
        ON shared_reports (expires_at)
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export function isReportStorageConfigured(): boolean {
  return Boolean(sql);
}

export async function createSharedReport(
  result: AnalyzeResult,
  ownerUserId: string | null,
  id: string
): Promise<SharedReport> {
  if (!sql) throw new ReportStorageUnavailableError();
  if (!REPORT_ID_PATTERN.test(id)) throw new Error("Invalid shared report ID.");
  await ensureSchema();

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SHARED_REPORT_TTL_MS);
  const payload = JSON.stringify(result);

  await sql`
    INSERT INTO shared_reports (id, payload, owner_user_id, created_at, expires_at)
    VALUES (
      ${id},
      ${payload}::jsonb,
      ${ownerUserId},
      ${createdAt.toISOString()},
      ${expiresAt.toISOString()}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  const rows = (await sql`
    SELECT id, payload, created_at, expires_at
    FROM shared_reports
    WHERE id = ${id}
    LIMIT 1
  `) as SharedReportRow[];
  const stored = rows[0];
  if (!stored) throw new Error("Shared report was not stored.");

  // Opportunistic bounded cleanup; expiry checks never depend on this delete.
  await sql`
    DELETE FROM shared_reports
    WHERE expires_at < now() - interval '7 days'
  `;

  return {
    id,
    result: stored.payload,
    createdAt: toIso(stored.created_at),
    expiresAt: toIso(stored.expires_at),
  };
}

export async function getSharedReport(id: string): Promise<SharedReportLookup> {
  if (!REPORT_ID_PATTERN.test(id) || !sql) {
    return { status: "missing", report: null };
  }
  await ensureSchema();

  const rows = (await sql`
    SELECT id, payload, created_at, expires_at
    FROM shared_reports
    WHERE id = ${id}
    LIMIT 1
  `) as SharedReportRow[];
  const row = rows[0];
  if (!row) return { status: "missing", report: null };

  const expiresAt = toIso(row.expires_at);
  if (Date.parse(expiresAt) <= Date.now()) {
    await sql`DELETE FROM shared_reports WHERE id = ${id}`;
    return { status: "expired", report: null };
  }

  return {
    status: "active",
    report: {
      id: row.id,
      result: row.payload,
      createdAt: toIso(row.created_at),
      expiresAt,
    },
  };
}
