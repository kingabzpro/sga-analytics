import type { ComponentProps } from "react";
import type { ClerkProvider, SignIn } from "@clerk/nextjs";
import { enUS } from "@clerk/localizations";

type ClerkAppearance = NonNullable<ComponentProps<typeof SignIn>["appearance"]>;
type ClerkLocalization = NonNullable<
  ComponentProps<typeof ClerkProvider>["localization"]
>;

/** Clerk component theming to match the teal design system (globals.css tokens). */
export const clerkAppearance: ClerkAppearance = {
  variables: {
    colorPrimary: "#0d9488",
    colorPrimaryForeground: "#ffffff",
    colorBackground: "#ffffff",
    colorForeground: "#0f172a",
    colorInput: "#ffffff",
    colorBorder: "#d9e4e2",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    // Center the fixed-width Clerk card inside whatever container it's in —
    // plain `text-center` doesn't move a block-level root box.
    rootBox: { marginInline: "auto" },
    // Hides the card's "Secured by clerk" branding row — it also carries the
    // orange "Development mode" badge. The footerAction link ("Already have an
    // account? Sign in") is a sibling and stays visible.
    footerItem: { display: "none" },
  },
};

/** Clerk embeds the raw application name ("sga-analytics") in card titles, and
 *  the app name isn't renamable through the CLI — localize the affected strings
 *  instead. Built on the full enUS resource (dictionary keys live at the TOP
 *  level, not under a `dictionary` key — partial objects are ignored). */
export const clerkLocalization = {
  ...structuredClone(enUS),
  signIn: {
    ...enUS.signIn!,
    start: {
      ...enUS.signIn!.start,
      title: "Sign in to SGA Analytics",
      titleCombined: "Sign in to SGA Analytics",
    },
  },
  signUp: {
    ...enUS.signUp!,
    start: {
      ...enUS.signUp!.start,
      title: "Create your SGA Analytics account",
      titleCombined: "Create your SGA Analytics account",
    },
  },
} as unknown as ClerkLocalization;
