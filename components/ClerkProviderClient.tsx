"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance, clerkLocalization } from "@/lib/clerk-theme";

/** Clerk provider rendered from the client tree. The RSC-exported
 *  <ClerkProvider> drops the `localization` prop during server serialization,
 *  so custom strings (the "SGA Analytics" card titles) only apply when the
 *  provider mounts on the client. */
export function ClerkProviderClient({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      localization={clerkLocalization}
    >
      {children}
    </ClerkProvider>
  );
}
