import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { listAccreditations } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import { RevokeDialog } from "@/components/features/reviews/revoke-dialog";

export const metadata: Metadata = { title: "Audit & integrity" };
export const dynamic = "force-dynamic";

/**
 * AI2/AI3 — accreditation history + revoke (Figma 287:12896/12899). The
 * designed per-organizer drill-down arrives with organizations (P6);
 * AI1 audit-log search needs the Part 6 audit_log table (P6); AI4
 * certificate revocation lands with certificates (P7).
 */
export default async function AuditIntegrityPage() {
  const rows = await listAccreditations();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">
          Accreditation history
        </h1>
        <p className="text-sm text-muted-foreground">
          Every accreditation issued — revoking one withdraws its credits
        </p>
      </div>

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex gap-4 rounded-t-lg bg-muted px-6 py-2.5 text-xs text-muted-foreground">
          <span className="flex-1">Event</span>
          <span className="w-40">Accredited on</span>
          <span className="w-32">Credits</span>
          <span className="w-28">Status</span>
          <span className="w-24" aria-hidden />
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No accreditations issued yet.
          </p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 border-t border-border px-6 py-3.5"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {r.eventTitle}
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {r.accreditationNumber}
                </span>
              </div>
              <span className="w-40 font-mono text-[13px] text-muted-foreground">
                {format(parseISO(r.accreditedOn), "dd MMM yyyy")}
              </span>
              <span className="w-32 font-mono text-[13px] text-foreground">
                {r.status === "revoked"
                  ? "0 · revoked"
                  : r.credits != null
                    ? `${r.credits.toFixed(0)} · ${r.categoryLabel ?? ""}`
                    : "—"}
              </span>
              <span className="w-28">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-xs",
                    r.status === "active"
                      ? "border-status-approved-border bg-status-approved-bg text-status-approved"
                      : "border-status-rejected-border bg-status-rejected-bg text-status-rejected"
                  )}
                >
                  {r.status === "active" ? "Accredited" : "Revoked"}
                </span>
              </span>
              <span className="w-24 text-right">
                {r.status === "active" ? (
                  <RevokeDialog
                    accreditationId={r.id}
                    eventTitle={r.eventTitle}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
