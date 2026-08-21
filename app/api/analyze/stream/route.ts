import { analyzeUrlCached } from "@/lib/cache";
import { requireSignIn } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const denied = await requireSignIn();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url.trim()) {
    return Response.json({ error: "URL is required" }, { status: 400 });
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
        .then(({ result, cached }) => send({ type: "result", result, cached }))
        .catch((error: unknown) => {
          send({
            type: "error",
            error: error instanceof Error ? error.message : "Analysis failed",
          });
        })
        .finally(() => controller.close());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
