/** Render-side gate (layout, page, /sign-in). NEXT_PUBLIC_* vars are inlined at
 *  build time, so this stays stable across static prerendering — set keys
 *  before running `next build` / deploying. */
export function isClerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}
