import { AnalyzerApp } from "@/components/AnalyzerApp";

export default function Home() {
  return (
    <main className="flex-1 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-zinc-50 to-zinc-100">
      <AnalyzerApp />
    </main>
  );
}
