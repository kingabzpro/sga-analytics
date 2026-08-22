import { NextResponse } from "next/server";
import { getAuditQuota } from "@/lib/audit-quota";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const allowance = await getAuditQuota(request);
  return NextResponse.json(allowance.status, {
    status: allowance.code === "QUOTA_UNAVAILABLE" ? 503 : 200,
  });
}
