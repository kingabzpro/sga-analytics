import type { Metadata } from "next";
import { DM_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SGA Analytics | SEO, GEO & AEO Scores",
  description:
    "Paste a URL to score SEO, Generative Engine Optimization (GEO), and Answer Engine Optimization (AEO) with clear, actionable tips.",
  // icon.tsx (32×32 PNG) and apple-icon.tsx (180×180 PNG) are auto-wired via
  // the file conventions — only the SVG (in /public) needs a manual entry here.
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "SGA Analytics",
    description:
      "Score any website for SEO, GEO, and AEO. Get checks and practical improvement tips.",
    images: ["/logo-mark.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${fraunces.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
