import type { Metadata } from "next";
import { Check, X, SearchX } from "lucide-react";
import { sql } from "@/lib/db";
import { cn } from "@/lib/utils";

/**
 * CT4 / PB — public certificate verification. No app shell: minimal brand
 * bar + centered result card (valid / revoked / not found). Reads through
 * verify_certificate() — the only public path the schema allows; the page
 * renders exactly the redacted fields the RPC returns.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Certificate Verification — Gradus" };

interface VerifyRow {
  certificate_number: string;
  kind: "event_attendance" | "cycle_completion";
  status: "active" | "revoked";
  practitioner_name: string | null;
  mmdc_number: string | null;
  issued_at: Date;
  event_title: string | null;
  event_dates: string | null;
  cycle_name: string | null;
  total_credits: string | null;
  revoked_at: Date | null;
  revocation_reason: string | null;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Indian/Maldives",
  });

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("text-right text-sm font-medium", mono && "font-mono text-[13px]")}>
        {value}
      </dd>
    </div>
  );
}

export default async function VerifyPage({
  params,
}: {
  params: { number: string };
}) {
  const number = decodeURIComponent(params.number);
  const rows = await sql<VerifyRow[]>`
    select * from verify_certificate(${number})
  `;
  const cert = rows[0] ?? null;
  const revoked = cert?.status === "revoked";

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <header className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <p className="text-sm font-medium">
          <span className="font-semibold text-primary">Gradus</span>{" "}
          <span className="text-muted-foreground">CPD SYSTEM</span>
        </p>
        <p className="text-sm text-muted-foreground">Certificate Verification</p>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 shadow-sm">
          {!cert ? (
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <SearchX className="h-7 w-7 text-muted-foreground" aria-hidden />
              </div>
              <h1 className="mt-5 text-2xl font-semibold">Certificate not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                No certificate with ID{" "}
                <span className="font-mono text-[13px]">{number}</span> exists in
                the Gradus CPD registry. Check the ID and try again.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full",
                  revoked ? "bg-status-rejected-bg" : "bg-status-approved-bg"
                )}
              >
                {revoked ? (
                  <X className="h-7 w-7 text-status-rejected" aria-hidden />
                ) : (
                  <Check className="h-7 w-7 text-status-approved" aria-hidden />
                )}
              </div>
              <h1 className="mt-5 text-center text-2xl font-semibold">
                {revoked ? "Certificate revoked" : "Certificate verified"}
              </h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {revoked
                  ? "This certificate was issued by Gradus CPD but has since been revoked and is no longer valid."
                  : "This certificate is valid and was issued by Gradus CPD on behalf of the Maldivian Medical Association."}
              </p>

              <dl className="mt-6 w-full divide-y divide-border rounded-md bg-muted px-4 py-1">
                {cert.practitioner_name && (
                  <Row label="Issued to" value={cert.practitioner_name} />
                )}
                <Row
                  label={cert.kind === "event_attendance" ? "Activity" : "Cycle"}
                  value={
                    (cert.kind === "event_attendance"
                      ? cert.event_title
                      : cert.cycle_name) ?? "—"
                  }
                />
                {(() => {
                  // daterange arrives as text, e.g. "[2026-06-21,2026-06-22)"
                  const start = cert.event_dates?.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
                  return start ? (
                    <Row
                      label="Date"
                      value={fmtDate(new Date(start + "T00:00:00Z"))}
                    />
                  ) : null;
                })()}
                {cert.total_credits != null && (
                  <Row
                    label="Credits"
                    value={`${Number(cert.total_credits)} CPD credits`}
                  />
                )}
                <Row label="Issued by" value="MMA CPD Committee" />
                <Row label="Issued on" value={fmtDate(cert.issued_at)} />
                <Row label="Certificate ID" value={cert.certificate_number} mono />
              </dl>

              {revoked ? (
                <div className="mt-4 w-full rounded-md bg-status-rejected-bg px-4 py-3 text-center text-sm font-medium text-status-rejected">
                  Revoked{cert.revoked_at ? ` on ${fmtDate(cert.revoked_at)}` : ""}
                  {cert.revocation_reason ? ` — ${cert.revocation_reason}` : ""}
                </div>
              ) : (
                <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-status-approved-bg px-4 py-3 text-sm font-medium text-status-approved">
                  <Check className="h-4 w-4" aria-hidden />
                  Verified on {fmtDate(new Date())}
                </div>
              )}

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Authenticity confirmed against the Gradus CPD registry.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
