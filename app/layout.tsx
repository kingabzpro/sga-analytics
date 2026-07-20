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
  title: "SGA Analytics | SEO, AEO & GEO Scores",
  description:
    "Paste a URL to score SEO, Answer Engine Optimization (AEO), and Generative Engine Optimization (GEO) with clear, actionable tips.",
  icons: {
    icon: "/logo-mark.jpg",
    apple: "/logo-mark.jpg",
  },
  openGraph: {
    title: "SGA Analytics",
    description:
      "Score any website for SEO, AEO, and GEO. Get checks and practical improvement tips.",
    images: ["/logo-mark.jpg"],
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
