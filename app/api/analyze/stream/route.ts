import { analyzeUrlCached, cacheKey } from "@/lib/cache";
import { NextResponse } from "next/server";
import { applyAuditQuotaHeaders, reserveAudit } from "@/lib/audit-quota";
import { createReportShareProof } from "@/lib/report-share-proof";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url.trim()) {
    return Response.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    // Validate before consuming a scarce audit allowance.
    cacheKey(url);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid URL" },
      { status: 400 }
    );
  }

  const allowance = await reserveAudit(request);
  if (!allowance.allowed) {
    return NextResponse.json(
      { error: allowance.error, code: allowance.code },
      { status: allowance.code === "SIGN_IN_REQUIRED" ? 401 : allowance.code === "QUOTA_EXHAUSTED" ? 429 : 503 }
    );
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream({
    start(controller) {
      const send = (value: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ ...value, elapsedMs: Date.now() - startedAt })}\n`)
        );
      };

      void analyzeUrlCached(url, {
        onProgress(event) {
          send({ type: "progress", ...event });
        },
      })
        .then(({ result, cached }) =>
          send({
            type: "result",
            result,
            cached,
            shareProof: createReportShareProof(result),
          })
        )
        .catch((error: unknown) => {
          send({
            type: "error",
            error: error instanceof Error ? error.message : "Analysis failed",
          });
        })
        .finally(() => controller.close());
    },
  });

  const response = new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
  applyAuditQuotaHeaders(response, allowance, request);
  return response;
}
