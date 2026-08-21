"use client";

import type { ReactNode } from "react";
import { Show, SignUp } from "@clerk/nextjs";
import { motion } from "motion/react";
import { clerkAppearance } from "@/lib/clerk-theme";

/** Magic-link gate rendered only when Clerk is configured. Signed-out visitors
 *  see the email sign-up card (password is disabled instance-side, so it's a
 *  single email field; Clerk's SignIn rejects unknown emails, hence SignUp-first
 *  for a gate whose visitors are mostly new); signed-in visitors get the auditor.
 *  Core 3 note: <Show> replaces the removed <SignedIn>/<SignedOut>. */
export function EmailGate({ children }: { children: ReactNode }) {
  return (
    <>
      <Show when="signed-out">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mb-8 w-full max-w-md text-center"
        >
          <SignUp fallbackRedirectUrl="/" appearance={clerkAppearance} />
        </motion.section>
      </Show>
      <Show when="signed-in">{children}</Show>
    </>
  );
}
