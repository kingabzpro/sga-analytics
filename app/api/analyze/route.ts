import { NextResponse } from "next/server";
import { analyzeUrlCached } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 30; // bounded external calls + transparent UI progress

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url : "";

    if (!url.trim()) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const { result, cached } = await analyzeUrlCached(url);
    return NextResponse.json(result, {
      headers: { "X-Cache": cached ? "HIT" : "MISS" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to analyze website";
    const status =
      /invalid|required|private|local|only http/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
