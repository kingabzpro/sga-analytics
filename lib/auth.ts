import { auth } from "@clerk/nextjs/server";

/** Render-side gate (layout, page, /sign-in). NEXT_PUBLIC_* vars are inlined at
 *  build time, so this stays stable across static prerendering — set keys
 *  before running `next build` / deploying. */
export function isClerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

/** API-route gate. Returns a 401 response when Clerk is configured and there is
 *  no signed-in user, `null` when the request may proceed. Fail-closed on Clerk
 *  errors so the gate can protect provider spend; never throws to the route. */
export async function requireSignIn(): Promise<Response | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;

  if (!process.env.CLERK_SECRET_KEY) {
    return Response.json(
      { error: "Sign-in is not configured on the server (missing CLERK_SECRET_KEY)." },
      { status: 503 }
    );
  }

  try {
    const { userId } = await auth();
    if (userId) return null;
  } catch {
    // Clerk failure — treat as signed-out (fail closed).
  }

  return Response.json(
    { error: "Please sign in with your email to run an audit." },
    { status: 401 }
  );
}
