import { auth } from "@clerk/nextjs/server";
import {
  AuditHistoryUnavailableError,
  getAuditHistoryEntry,
} from "@/lib/audit-history";
import { createReportShareProof } from "@/lib/report-share-proof";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let userId: string | null = null;
  try {
    userId = (await auth()).userId ?? null;
  } catch {
    return Response.json({ error: "Audit history is not configured." }, { status: 503 });
  }
  if (!userId) {
    return Response.json({ error: "Sign in to view audit history." }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const entry = await getAuditHistoryEntry(userId, id);
    if (!entry) {
      return Response.json({ error: "Audit history entry not found." }, { status: 404 });
    }
    return Response.json(
      { entry, shareProof: createReportShareProof(entry.result) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuditHistoryUnavailableError) {
      return Response.json({ error: "Audit history is not configured." }, { status: 503 });
    }
    console.error("Failed to load audit history entry", error);
    return Response.json({ error: "Could not load this audit." }, { status: 500 });
  }
}
