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

console.log("Shared reports schema is ready.");
