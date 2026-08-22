import { auth } from "@clerk/nextjs/server";
import {
  MAX_SHARED_REPORT_BYTES,
  isAnalyzeResult,
  reportIdFromProof,
  verifyReportShareProof,
} from "@/lib/report-share-proof";
import {
  createSharedReport,
  ReportStorageUnavailableError,
} from "@/lib/shared-reports";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SHARED_REPORT_BYTES) {
    return Response.json({ error: "Report payload is too large." }, { status: 413 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_SHARED_REPORT_BYTES) {
    return Response.json({ error: "Report payload is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid report request." }, { status: 400 });
  }

  const candidate = body as { result?: unknown; shareProof?: unknown };
  if (
    !isAnalyzeResult(candidate.result) ||
    typeof candidate.shareProof !== "string" ||
    !verifyReportShareProof(candidate.result, candidate.shareProof)
  ) {
    return Response.json(
      { error: "This audit can no longer be shared. Run a new audit and try again." },
      { status: 403 }
    );
  }

  let ownerUserId: string | null = null;
  try {
    ownerUserId = (await auth()).userId ?? null;
  } catch {
    // Public sharing also works for the one anonymous audit.
  }

  try {
    const report = await createSharedReport(
      candidate.result,
      ownerUserId,
      reportIdFromProof(candidate.shareProof)
    );
    const url = new URL(`/report/${report.id}`, request.url).toString();
    return Response.json(
      { id: report.id, url, expiresAt: report.expiresAt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ReportStorageUnavailableError) {
      return Response.json(
        { error: "Temporary report sharing is not configured." },
        { status: 503 }
      );
    }
    console.error("Failed to create shared report", error);
    return Response.json(
      { error: "We could not create the shared report. Please try again." },
      { status: 500 }
    );
  }
}
