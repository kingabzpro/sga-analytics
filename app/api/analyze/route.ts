import { NextResponse } from "next/server";
import { analyzeUrlCached, cacheKey } from "@/lib/cache";
import { applyAuditQuotaHeaders, reserveAudit } from "@/lib/audit-quota";

export const runtime = "nodejs";
export const maxDuration = 30; // bounded external calls + transparent UI progress

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url : "";

    if (!url.trim()) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate before consuming a scarce audit allowance.
    cacheKey(url);

    const allowance = await reserveAudit(request);
    if (!allowance.allowed) {
      return NextResponse.json(
        { error: allowance.error, code: allowance.code },
        { status: allowance.code === "SIGN_IN_REQUIRED" ? 401 : allowance.code === "QUOTA_EXHAUSTED" ? 429 : 503 }
      );
    }

    const { result, cached } = await analyzeUrlCached(url);
    const response = NextResponse.json(result, {
      headers: { "X-Cache": cached ? "HIT" : "MISS" },
    });
    applyAuditQuotaHeaders(response, allowance, request);
    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to analyze website";
    const status =
      /invalid|required|private|local|only http/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
