import { auth } from "@clerk/nextjs/server";
import {
  AuditHistoryUnavailableError,
  listAuditHistory,
} from "@/lib/audit-history";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET() {
  let userId: string | null = null;
  try {
    userId = (await auth()).userId ?? null;
  } catch {
    return Response.json({ error: "Audit history is not configured." }, { status: 503 });
  }
  if (!userId) {
    return Response.json({ error: "Sign in to view audit history." }, { status: 401 });
  }

  try {
    const entries = await listAuditHistory(userId);
    return Response.json(
      { entries },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuditHistoryUnavailableError) {
      return Response.json({ error: "Audit history is not configured." }, { status: 503 });
    }
    console.error("Failed to list audit history", error);
    return Response.json({ error: "Could not load audit history." }, { status: 500 });
  }
}
