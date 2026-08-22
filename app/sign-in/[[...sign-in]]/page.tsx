import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth";
import { clerkAppearance } from "@/lib/clerk-theme";

export const metadata: Metadata = {
  title: "Sign in | SGA Analytics",
};

export default function SignInPage() {
  if (!isClerkConfigured()) redirect("/");

  return (
    <main className="app-shell flex flex-1 items-center justify-center px-4 py-12">
      <SignIn
        fallbackRedirectUrl="/"
        appearance={clerkAppearance}
        withSignUp
      />
    </main>
  );
}
