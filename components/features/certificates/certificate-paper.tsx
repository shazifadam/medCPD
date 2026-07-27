/* eslint-disable @next/next/no-img-element */
import { Award } from "lucide-react";
import { format } from "date-fns";
import type { CertificateDetail } from "@/lib/certificates";
import { cn } from "@/lib/utils";

/**
 * CT2/CT3 — the on-screen certificate document (blue = event attendance,
 * green = cycle completion). Mirrors the PDF renderer's layout.
 */
export function CertificatePaper({
  cert,
  qrDataUrl,
}: {
  cert: CertificateDetail;
  qrDataUrl: string;
}) {
  const isEvent = cert.kind === "event_attendance";
  const p = cert.payload;
  const credit = isEvent ? p?.credits?.[0] : null;
  const fmt = (d?: string | null) =>
    d ? format(new Date(d + "T00:00:00Z"), "d MMMM yyyy") : "";

  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-card px-10 py-12 text-center">
      <div
        className={cn(
          "h-1 w-20 rounded-full",
          isEvent ? "bg-primary" : "bg-success"
        )}
        aria-hidden
      />
      <span
        className={cn(
          "mt-8 flex h-14 w-14 items-center justify-center rounded-full",
          isEvent ? "bg-accent text-primary" : "bg-status-approved-bg text-status-approved"
        )}
      >
        <Award className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-semibold tracking-[0.3em] text-foreground">
        GRADUS CPD
      </p>
      <p className="text-xs text-muted-foreground">
        Maldivian Medical Association
      </p>
      <h2
        className={cn(
          "mt-8 text-2xl font-semibold tracking-[0.2em]",
          isEvent ? "text-primary" : "text-status-approved"
        )}
      >
        {isEvent ? "CERTIFICATE OF ATTENDANCE" : "CERTIFICATE OF COMPLETION"}
      </h2>
      <p className="mt-8 text-sm text-muted-foreground">
        This is to certify that
      </p>
      <p className="mt-2 text-3xl font-semibold text-foreground">
        {p?.practitioner?.display_name}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        {isEvent
          ? "has attended and completed"
          : "has successfully completed the continuing professional development cycle"}
      </p>
      <p className="mt-2 text-lg font-semibold text-foreground">
        {isEvent ? p?.event?.title : p?.cycle?.name}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {isEvent
          ? `held on ${fmt(p?.event?.starts_on)}${p?.event?.venue ? ` · ${p.event.venue}` : ""}`
          : `${fmt(p?.cycle?.starts_on)} – ${fmt(p?.cycle?.ends_on)}`}
      </p>
      <p className="mt-6 max-w-md text-sm text-foreground">
        {isEvent
          ? `Awarded ${credit?.credits} CPD credits (${credit?.category_name ?? credit?.category_code}) under the MMA Continuing Professional Development Framework.`
          : `Achieved ${p?.totals?.earned} of ${p?.totals?.required} required CPD credits and satisfied all category floor requirements under the MMA Continuing Professional Development Framework.`}
      </p>

      <div className="mt-10 flex w-full items-end justify-between border-t border-border pt-8">
        <div className="flex flex-col items-start">
          <span className="w-36 border-b border-foreground" aria-hidden />
          <span className="mt-2 text-xs text-muted-foreground">
            Registrar, MMA CPD Committee
          </span>
        </div>
        <div className="flex flex-col items-center">
          <img src={qrDataUrl} alt="Verification QR code" className="h-16 w-16" />
          <span className="mt-1 text-[10px] text-muted-foreground">
            Scan to verify
          </span>
        </div>
      </div>
      <p className="mt-6 font-mono text-[13px] text-muted-foreground">
        Certificate ID: {cert.certificateNumber}
      </p>
    </div>
  );
}
