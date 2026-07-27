import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { listAllCertificates, listIssueOptions } from "@/lib/certificates";
import { IssueDialog } from "@/components/features/certificates/issue-dialog";
import { RevokeDialog } from "@/components/features/certificates/revoke-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Certificates" };
export const dynamic = "force-dynamic";

/**
 * CA1 — admin certificates (Figma 287:13011): search + type/status filters,
 * table of all issued certificates, manual issue (CA2) + revoke (CA3).
 * Deviation, deliberate: filters are native selects in a GET form (matches
 * the audit-log page pattern); revoke sits beside View on active rows (the
 * frame only shows View — CA3 needs a trigger).
 */
export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; status?: string };
}) {
  const kind =
    searchParams.type === "event"
      ? ("event_attendance" as const)
      : searchParams.type === "cycle"
        ? ("cycle_completion" as const)
        : undefined;
  const status =
    searchParams.status === "valid"
      ? ("active" as const)
      : searchParams.status === "revoked"
        ? ("revoked" as const)
        : undefined;

  const [certs, options] = await Promise.all([
    listAllCertificates({ search: searchParams.q, kind, status }),
    listIssueOptions(),
  ]);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-foreground">
            Certificates
          </h1>
          <p className="text-sm text-muted-foreground">
            All issued CPD certificates across practitioners and events
          </p>
        </div>
        <IssueDialog
          practitioners={options.practitioners}
          events={options.events}
        />
      </div>

      <form className="flex gap-3" action="/admin/certificates" method="GET">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Search by certificate ID, holder or event…"
            className="pl-9"
            aria-label="Search certificates"
          />
        </div>
        <select
          name="type"
          defaultValue={searchParams.type ?? ""}
          aria-label="Certificate type"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All types</option>
          <option value="event">Event</option>
          <option value="cycle">Cycle completion</option>
        </select>
        <select
          name="status"
          defaultValue={searchParams.status ?? ""}
          aria-label="Certificate status"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="valid">Valid</option>
          <option value="revoked">Revoked</option>
        </select>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex gap-4 rounded-t-lg bg-muted px-6 py-2.5 text-xs text-muted-foreground">
          <span className="flex-1">Certificate</span>
          <span className="w-32">Type</span>
          <span className="w-28">Issued</span>
          <span className="w-24">Status</span>
          <span className="w-36" aria-hidden />
        </div>
        {certs.length === 0 && (
          <p className="border-t border-border px-6 py-10 text-center text-sm text-muted-foreground">
            No certificates match.
          </p>
        )}
        {certs.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-4 border-t border-border px-6 py-3.5"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {c.holderName} · {c.title}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {c.certificateNumber}
              </span>
            </div>
            <span className="w-32 text-sm text-foreground">
              {c.kind === "event_attendance" ? "Event" : "Cycle completion"}
            </span>
            <span className="w-28 font-mono text-[13px] text-muted-foreground">
              {format(c.issuedAt, "dd MMM yyyy")}
            </span>
            <span className="w-24">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-xs",
                  c.status === "active"
                    ? "border-status-approved-border bg-status-approved-bg text-status-approved"
                    : "border-status-rejected-border bg-status-rejected-bg text-status-rejected"
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-current"
                  aria-hidden
                />
                {c.status === "active" ? "Valid" : "Revoked"}
              </span>
            </span>
            <span className="flex w-36 items-center justify-end gap-1">
              <Button asChild variant="outline" size="sm">
                <Link href={`/my-cpd/certificates/${c.id}`}>View</Link>
              </Button>
              {c.status === "active" && (
                <RevokeDialog
                  certificateId={c.id}
                  certificateNumber={c.certificateNumber}
                  holderName={c.holderName ?? ""}
                />
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
