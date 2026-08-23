import { analyzeUrlCached, cacheKey } from "@/lib/cache";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { applyAuditQuotaHeaders, reserveAudit } from "@/lib/audit-quota";
import { createReportShareProof } from "@/lib/report-share-proof";
import {
  isAuditHistoryConfigured,
  recordAuditHistory,
} from "@/lib/audit-history";
import type { AnalyzeResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  const fresh = body?.fresh === true;
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

  let ownerUserId: string | null = null;
  if (allowance.status.authenticated && isAuditHistoryConfigured()) {
    try {
      ownerUserId = (await auth()).userId ?? null;
    } catch {
      // The audit can still finish if optional history storage is unavailable.
    }
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
        fresh,
        onProgress(event) {
          send({ type: "progress", ...event });
        },
      })
        .then(async ({ result, cached }) => {
          let historyId: string | null = null;
          let comparisonBase: AnalyzeResult | null = null;
          if (ownerUserId) {
            try {
              const recorded = await recordAuditHistory(ownerUserId, result);
              historyId = recorded.entry.id;
              comparisonBase = recorded.previousResult;
              send({
                type: "progress",
                stage: "history",
                message: comparisonBase
                  ? "Saved audit and compared it with the previous result"
                  : "Saved audit to your 30-day history",
              });
            } catch (historyError) {
              console.error("Failed to save audit history", historyError);
            }
          }
          send({
            type: "result",
            result,
            cached,
            shareProof: createReportShareProof(result),
            historyId,
            comparisonBase,
          });
        })
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
