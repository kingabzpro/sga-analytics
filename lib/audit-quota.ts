import { createHmac, timingSafeEqual } from "node:crypto";
import { auth, clerkClient } from "@clerk/nextjs/server";
import type { NextResponse } from "next/server";

const ANONYMOUS_LIMIT = 1;
const DEFAULT_MEMBER_LIMIT = 5;
const MAX_MEMBER_LIMIT = 1_000;
const ANONYMOUS_COOKIE = "sga_anon_audit";
const USAGE_METADATA_KEY = "sgaAnalyticsAuditsUsed";
const LIMIT_METADATA_KEY = "sgaAnalyticsAuditLimit";

export type AuditQuotaStatus = {
  enabled: boolean;
  authenticated: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
};

export type AuditAllowance = {
  allowed: boolean;
  status: AuditQuotaStatus;
  code?: "SIGN_IN_REQUIRED" | "QUOTA_EXHAUSTED" | "QUOTA_UNAVAILABLE";
  error?: string;
  anonymousCookie?: string;
};

function quotaSecret(): string | null {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  return process.env.CLERK_SECRET_KEY ?? null;
}

function clampUsage(value: unknown, limit: number): number {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.max(0, Math.min(value, limit))
    : 0;
}

function memberLimit(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.max(DEFAULT_MEMBER_LIMIT, Math.min(value, MAX_MEMBER_LIMIT))
    : DEFAULT_MEMBER_LIMIT;
}

function signAnonymousUsage(used: number, secret: string): string {
  const payload = String(used);
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readAnonymousUsage(request: Request, secret: string): number {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const raw = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${ANONYMOUS_COOKIE}=`))
    ?.slice(ANONYMOUS_COOKIE.length + 1);

  if (!raw) return 0;
  const [payload, signature] = decodeURIComponent(raw).split(".");
  if (!payload || !signature) return 0;

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return 0;
  }

  return clampUsage(Number(payload), ANONYMOUS_LIMIT);
}

function status(authenticated: boolean, limit: number, used: number): AuditQuotaStatus {
  return {
    enabled: true,
    authenticated,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

async function currentUserId(): Promise<string | null> {
  try {
    const session = await auth();
    return session.userId ?? null;
  } catch {
    return null;
  }
}

/** Returns quota status without consuming an audit. Fail-closed when Clerk is
 * configured incorrectly so paid provider calls cannot silently become open. */
export async function getAuditQuota(request: Request): Promise<AuditAllowance> {
  const secret = quotaSecret();
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return {
      allowed: true,
      status: {
        enabled: false,
        authenticated: false,
        limit: null,
        used: 0,
        remaining: null,
      },
    };
  }

  if (!secret) {
    return {
      allowed: false,
      code: "QUOTA_UNAVAILABLE",
      error: "Audit access is not configured on the server.",
      status: status(false, ANONYMOUS_LIMIT, ANONYMOUS_LIMIT),
    };
  }

  const userId = await currentUserId();
  if (!userId) {
    const used = readAnonymousUsage(request, secret);
    return {
      allowed: used < ANONYMOUS_LIMIT,
      code: used >= ANONYMOUS_LIMIT ? "SIGN_IN_REQUIRED" : undefined,
      error:
        used >= ANONYMOUS_LIMIT
          ? "Your free audit is used. Sign in to unlock 5 more free audits."
          : undefined,
      status: status(false, ANONYMOUS_LIMIT, used),
    };
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const limit = memberLimit(user.privateMetadata[LIMIT_METADATA_KEY]);
    const used = clampUsage(user.privateMetadata[USAGE_METADATA_KEY], limit);
    return {
      allowed: used < limit,
      code: used >= limit ? "QUOTA_EXHAUSTED" : undefined,
      error:
        used >= limit
          ? `You have used all ${limit} free member audits.`
          : undefined,
      status: status(true, limit, used),
    };
  } catch {
    return {
      allowed: false,
      code: "QUOTA_UNAVAILABLE",
      error: "We could not verify your free audits. Please try again.",
      status: status(true, DEFAULT_MEMBER_LIMIT, DEFAULT_MEMBER_LIMIT),
    };
  }
}

/** Reserves one audit before the provider pipeline begins. */
export async function reserveAudit(request: Request): Promise<AuditAllowance> {
  const allowance = await getAuditQuota(request);
  if (!allowance.allowed || !allowance.status.enabled) return allowance;

  const nextUsed = allowance.status.used + 1;
  if (!allowance.status.authenticated) {
    const secret = quotaSecret();
    if (!secret) return allowance;
    return {
      ...allowance,
      status: status(false, ANONYMOUS_LIMIT, nextUsed),
      anonymousCookie: signAnonymousUsage(nextUsed, secret),
    };
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        ...allowance,
        allowed: false,
        code: "SIGN_IN_REQUIRED",
        error: "Please sign in and try again.",
      };
    }
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { [USAGE_METADATA_KEY]: nextUsed },
    });
    return {
      ...allowance,
      status: status(true, allowance.status.limit ?? DEFAULT_MEMBER_LIMIT, nextUsed),
    };
  } catch {
    return {
      ...allowance,
      allowed: false,
      code: "QUOTA_UNAVAILABLE",
      error: "We could not reserve your free audit. Please try again.",
    };
  }
}

export function applyAuditQuotaHeaders(
  response: NextResponse | Response,
  allowance: AuditAllowance,
  request: Request
): void {
  if (allowance.status.remaining != null) {
    response.headers.set("X-Audits-Remaining", String(allowance.status.remaining));
  }

  if (!allowance.anonymousCookie) return;
  const secure = new URL(request.url).protocol === "https:";
  const cookie = [
    `${ANONYMOUS_COOKIE}=${encodeURIComponent(allowance.anonymousCookie)}`,
    "Path=/",
    "Max-Age=31536000",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
  response.headers.append("Set-Cookie", cookie);
}
