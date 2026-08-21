import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth";
import { clerkAppearance } from "@/lib/clerk-theme";

export const metadata: Metadata = {
  title: "Sign up | SGA Analytics",
};

export default function SignUpPage() {
  if (!isClerkConfigured()) redirect("/");

  return (
    <main className="app-shell flex flex-1 items-center justify-center px-4 py-12">
      <SignUp fallbackRedirectUrl="/" appearance={clerkAppearance} />
    </main>
  );
}
