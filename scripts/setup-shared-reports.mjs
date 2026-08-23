import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sql = neon(databaseUrl);
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

console.log("Shared reports and audit history schemas are ready.");
