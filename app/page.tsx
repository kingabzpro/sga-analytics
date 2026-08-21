import { AnalyzerApp } from "@/components/AnalyzerApp";
import { isClerkConfigured } from "@/lib/auth";

export default function Home() {
  return (
    <main className="app-shell flex-1">
      <AnalyzerApp authEnabled={isClerkConfigured()} />
    </main>
  );
}
