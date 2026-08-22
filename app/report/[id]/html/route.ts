import { getSharedReport } from "@/lib/shared-reports";
import { renderSharedReportHtml, sharedReportFilename } from "@/lib/report-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/report/[id]/html">
) {
  const { id } = await context.params;
  const lookup = await getSharedReport(id);
  if (lookup.status !== "active") {
    return new Response(
      lookup.status === "expired" ? "This report has expired." : "Report not found.",
      { status: lookup.status === "expired" ? 410 : 404 }
    );
  }

  const html = renderSharedReportHtml(
    lookup.report.result,
    lookup.report.expiresAt
  );
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sharedReportFilename(lookup.report.result)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
    },
  });
}
