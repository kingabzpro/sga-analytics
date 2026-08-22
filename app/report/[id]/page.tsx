import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ReportView } from "@/components/ReportView";
import { getSharedReport } from "@/lib/shared-reports";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared website audit | SGA Analytics",
  description: "A temporary SGA Analytics website-audit report.",
  robots: { index: false, follow: false },
};

function UnavailableReport({ expired }: { expired: boolean }) {
  return (
    <main className="app-shell grid min-h-screen place-items-center px-4 py-12">
      <section className="glass-panel w-full max-w-lg rounded-3xl p-7 text-center sm:p-10">
        <Logo className="justify-center" />
        <div className="mx-auto mt-8 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-xl text-slate-500">
          {expired ? "⌛" : "?"}
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold text-slate-900">
          {expired ? "This report has expired" : "Report not found"}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
          {expired
            ? "Shared reports are available for 24 hours. Run a fresh audit to create a new link."
            : "Check the link, or run a new website audit."}
        </p>
        <Link
          href="/"
          className="btn-primary mt-7 inline-flex rounded-xl px-5 py-3 text-sm font-semibold text-white"
        >
          Run a new audit
        </Link>
      </section>
    </main>
  );
}

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lookup = await getSharedReport(id);
  if (lookup.status !== "active") {
    return <UnavailableReport expired={lookup.status === "expired"} />;
  }

  return (
    <main className="app-shell min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <nav className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" aria-label="SGA Analytics home">
            <Logo size="md" />
          </Link>
          <Link
            href="/"
            className="rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-teal-700 shadow-sm ring-1 ring-teal-200 transition hover:bg-teal-50"
          >
            Run another audit
          </Link>
        </nav>

        <div className="mb-6 rounded-2xl border border-teal-200 bg-teal-50/90 px-4 py-3 text-sm text-teal-900 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <span className="font-semibold">Temporary shared report</span>
          <span className="mt-1 block text-xs text-teal-700 sm:mt-0">
            Available until{" "}
            {new Date(lookup.report.expiresAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            })}{" "}
            UTC
          </span>
        </div>

        <ReportView
          result={lookup.report.result}
          shared={{ id: lookup.report.id, expiresAt: lookup.report.expiresAt }}
        />
      </div>
    </main>
  );
}
