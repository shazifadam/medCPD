import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { listAdminEvents } from "@/lib/admin-events";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Manage events" };
export const dynamic = "force-dynamic";

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-border bg-muted text-muted-foreground" },
  submitted: {
    label: "Submitted",
    className:
      "border-status-pending-border bg-status-pending-bg text-status-pending",
  },
  under_review: {
    label: "Under review",
    className:
      "border-status-under-review-border bg-status-under-review-bg text-status-under-review",
  },
  approved: {
    label: "Accredited",
    className:
      "border-status-approved-border bg-status-approved-bg text-status-approved",
  },
  rejected: {
    label: "Rejected",
    className:
      "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
  },
  completed: {
    label: "Completed",
    className:
      "border-status-approved-border bg-status-approved-bg text-status-approved",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-border bg-muted text-muted-foreground",
  },
};

/** EM — manage events list (admin). */
export default async function ManageEventsPage() {
  const rows = await listAdminEvents();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-foreground">
            Manage events
          </h1>
          <p className="text-sm text-muted-foreground">
            Create events, submit them for accreditation, and run attendance
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Create event
          </Link>
        </Button>
      </div>

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex gap-4 rounded-t-lg bg-muted px-6 py-2.5 text-xs text-muted-foreground">
          <span className="flex-1">Event</span>
          <span className="w-32">Starts</span>
          <span className="w-28">Registered</span>
          <span className="w-24">Credits</span>
          <span className="w-32">Status</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No events yet — create the first one.
          </p>
        ) : (
          rows.map((r) => {
            const pill = STATUS_PILL[r.status] ?? STATUS_PILL.draft;
            return (
              <Link
                key={r.id}
                href={`/admin/events/${r.id}`}
                className="flex items-center gap-4 border-t border-border px-6 py-3.5 hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {r.title}
                  </span>
                  {r.venueName && (
                    <span className="truncate text-xs text-muted-foreground">
                      {r.venueName}
                    </span>
                  )}
                </div>
                <span className="w-32 font-mono text-[13px] text-muted-foreground">
                  {format(parseISO(r.startsAt), "dd MMM yyyy")}
                </span>
                <span className="w-28 font-mono text-[13px] text-foreground">
                  {r.registeredCount}
                </span>
                <span className="w-24 font-mono text-[13px] text-foreground">
                  {r.credits != null ? r.credits.toFixed(1) : "—"}
                </span>
                <span className="w-32">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-[9px] py-[3px] text-xs",
                      pill.className
                    )}
                  >
                    {pill.label}
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
