import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Env-gated like every external integration: without Clerk keys the proxy is a
// pass-through, so zero-config deployments never touch Clerk.
const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

const passthrough = () => NextResponse.next();

export default clerkConfigured ? clerkMiddleware() : passthrough;

export const config = {
  matcher: [
    // Run on everything except Next internals and public assets. Flat
    // alternation only — Next 16's path-to-regexp rejects the nested-group
    // matcher pattern from Clerk's older docs. The catch-all below covers
    // `/`, `/api/*`, `/sign-in`, `/verify` (magic-link handshake) and
    // `/__clerk/*`; the explicit entries are Clerk's recommended shape.
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|file.svg|globe.svg|logo-mark.jpg|logo-mark.png|next.svg|vercel.svg|window.svg).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
