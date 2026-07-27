import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Award } from "lucide-react";
import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth/identity";
import {
  ensureEventCertificates,
  ensureCycleCertificate,
  listMyCertificates,
  type CertificateRow,
} from "@/lib/certificates";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Certificates" };
export const dynamic = "force-dynamic";

/**
 * CT1 — practitioner certificates (Figma 287:12998). Lives under /my-cpd so
 * the sidebar keeps My CPD active, matching the frame (practitioner nav has
 * no Certificates item by design). v1 issuance is on-demand: opening this
 * page materialises any missing eligible certificates before listing.
 */

const TABS = [
  { key: "all", label: "All" },
  { key: "event", label: "Event certificates" },
  { key: "cycle", label: "Cycle certificates" },
] as const;

function CertificateCard({ cert }: { cert: CertificateRow }) {
  const isEvent = cert.kind === "event_attendance";
  const dateLabel = cert.occurredOn
    ? format(new Date(cert.occurredOn + "T00:00:00Z"), "d MMM yyyy")
    : format(cert.issuedAt, "d MMM yyyy");

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3",
          isEvent ? "bg-accent" : "bg-status-approved-bg"
        )}
      >
        <span
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            isEvent ? "text-primary" : "text-status-approved"
          )}
        >
          <Award className="h-4 w-4" aria-hidden />
          {isEvent ? "Event certificate" : "Cycle completion certificate"}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
            cert.status === "active"
              ? "text-status-approved"
              : "text-status-rejected"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {cert.status === "active" ? "Issued" : "Revoked"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t border-border px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">{cert.title}</h2>
        <p className="text-sm text-muted-foreground">
          {isEvent ? "Attended" : "Issued"} {dateLabel}
          {!isEvent && " · Cycle completion"}
        </p>
        <p className="font-mono text-[13px] text-muted-foreground">
          {isEvent
            ? `${cert.credits ?? "—"} CPD credits${cert.categoryLabel ? ` · ${cert.categoryLabel}` : ""}`
            : `${cert.credits ?? "—"} credits · All category floors met`}
        </p>
      </div>

      <div className="flex gap-2 border-t border-border px-5 py-4">
        <Button asChild className="flex-1">
          <a
            href={`/my-cpd/certificates/${cert.id}/pdf`}
            target="_blank"
            rel="noopener"
          >
            Download PDF
          </a>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/my-cpd/certificates/${cert.id}`}>View</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const identity = await getIdentity();
  if (!identity) redirect("/login");

  // On-demand issuance (schema Q-issuance, v1 stance): generate-if-missing.
  await ensureEventCertificates(identity.user.id);
  await ensureCycleCertificate(identity.user.id);

  const all = await listMyCertificates(identity.user.id);
  const tab = TABS.some((t) => t.key === searchParams.type)
    ? (searchParams.type as (typeof TABS)[number]["key"])
    : "all";
  const certs = all.filter(
    (c) =>
      tab === "all" ||
      (tab === "event"
        ? c.kind === "event_attendance"
        : c.kind === "cycle_completion")
  );

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">Certificates</h1>
        <p className="text-sm text-muted-foreground">
          Download and share certificates for your completed CPD
        </p>
      </div>

      <nav aria-label="Certificate type" className="flex items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={
              t.key === "all"
                ? "/my-cpd/certificates"
                : `/my-cpd/certificates?type=${t.key}`
            }
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm",
              tab === t.key
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {certs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No certificates yet. Certificates appear here after you attend
          accredited events or complete your CPD cycle.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {certs.map((c) => (
            <CertificateCard key={c.id} cert={c} />
          ))}
        </div>
      )}
    </div>
  );
}
