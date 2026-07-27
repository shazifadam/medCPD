import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import QRCode from "qrcode";
import { getIdentity, hasRole } from "@/lib/auth/identity";
import { getCertificate } from "@/lib/certificates";
import { CertificatePaper } from "@/components/features/certificates/certificate-paper";
import { CertActions } from "@/components/features/certificates/cert-actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Certificate" };
export const dynamic = "force-dynamic";

/**
 * CT2 (event) / CT3 (cycle) — certificate detail: paper on the left,
 * status + actions + details rail on the right. Owner or committee/admin.
 */

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border py-3 first:border-t-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm font-medium text-foreground", mono && "font-mono text-[13px]")}>
        {value}
      </dd>
    </div>
  );
}

export default async function CertificateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const identity = await getIdentity();
  if (!identity) redirect("/login");

  const cert = await getCertificate(params.id);
  if (!cert) notFound();
  const elevated =
    hasRole(identity, "mma_admin") || hasRole(identity, "cpd_committee");
  if (cert.practitionerId !== identity.user.id && !elevated) notFound();

  const isEvent = cert.kind === "event_attendance";
  const p = cert.payload;
  const credit = isEvent ? p?.credits?.[0] : null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const qrDataUrl = await QRCode.toDataURL(
    `${appUrl}/verify/${cert.certificateNumber}`,
    { margin: 0, width: 256 }
  );
  const fmt = (d?: string | null) =>
    d ? format(new Date(d + "T00:00:00Z"), "d MMMM yyyy") : "—";

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link
          href="/my-cpd/certificates"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Certificates
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">
          {isEvent ? "Event certificate" : "Cycle completion certificate"}
        </h1>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
        <CertificatePaper cert={cert} qrDataUrl={qrDataUrl} />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
            <span
              className={cn(
                "inline-flex w-fit items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-xs",
                cert.status === "active"
                  ? "border-status-approved-border bg-status-approved-bg text-status-approved"
                  : "border-status-rejected-border bg-status-rejected-bg text-status-rejected"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              {cert.status === "active" ? "Issued" : "Revoked"}
            </span>
            {cert.status === "revoked" && (
              <p className="text-sm text-status-rejected">
                Revoked{cert.revokedAt ? ` on ${format(cert.revokedAt, "d MMMM yyyy")}` : ""}
                {cert.revocationReason ? ` — ${cert.revocationReason}` : ""}
              </p>
            )}
            <CertActions
              certId={cert.id}
              certificateNumber={cert.certificateNumber}
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="border-b border-border pb-3 text-base font-semibold text-foreground">
              Certificate details
            </h2>
            <dl className="mt-1">
              {isEvent ? (
                <>
                  <DetailRow label="Event" value={p?.event?.title ?? "—"} />
                  <DetailRow
                    label="Date attended"
                    value={fmt(p?.event?.starts_on)}
                  />
                  <DetailRow
                    label="Credits"
                    value={`${credit?.credits ?? "—"} CPD credits`}
                    mono
                  />
                  <DetailRow
                    label="Category"
                    value={credit?.category_name ?? credit?.category_code ?? "—"}
                  />
                </>
              ) : (
                <>
                  <DetailRow label="Cycle" value={p?.cycle?.name ?? "—"} />
                  <DetailRow
                    label="Cycle period"
                    value={`${fmt(p?.cycle?.starts_on)} – ${fmt(p?.cycle?.ends_on)}`}
                  />
                  <DetailRow
                    label="Credits"
                    value={`${p?.totals?.earned ?? "—"} / ${p?.totals?.required ?? "—"} credits`}
                    mono
                  />
                  <DetailRow
                    label="Requirement"
                    value="All category floors met"
                  />
                </>
              )}
              <DetailRow label="Issued by" value="MMA CPD Committee" />
              <DetailRow
                label="Issued on"
                value={format(cert.issuedAt, "d MMMM yyyy")}
              />
              <DetailRow
                label="Certificate ID"
                value={cert.certificateNumber}
                mono
              />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
