"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { EventReviewRow, EventReviewState } from "@/lib/reviews";
import { Button } from "@/components/ui/button";

type Tab = "pending" | "revisions" | "approved" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending review" },
  { key: "revisions", label: "Revisions requested" },
  { key: "approved", label: "Approved" },
  { key: "all", label: "All" },
];

const STATE_PILL: Record<
  EventReviewState,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending review",
    className:
      "border-status-pending-border bg-status-pending-bg text-status-pending",
  },
  revisions: {
    label: "Revisions requested",
    className:
      "border-status-under-review-border bg-status-under-review-bg text-status-under-review",
  },
  rejected: {
    label: "Rejected",
    className:
      "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
  },
  approved: {
    label: "Approved",
    className:
      "border-status-approved-border bg-status-approved-bg text-status-approved",
  },
};

/** ER1/ER2 — accreditation request queue. */
export function EventQueue({ rows }: { rows: EventReviewRow[] }) {
  const [tab, setTab] = useState<Tab>("pending");

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.state === "pending").length,
      revisions: rows.filter((r) => r.state === "revisions").length,
      approved: rows.filter((r) => r.state === "approved").length,
      all: rows.length,
    }),
    [rows]
  );

  const visible = useMemo(
    () => rows.filter((r) => tab === "all" || r.state === tab),
    [rows, tab]
  );

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Filter events" className="flex gap-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              <span className="rounded-full bg-muted px-2 py-px text-xs text-muted-foreground">
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex gap-4 rounded-t-lg bg-muted px-6 py-2.5 text-xs text-muted-foreground">
          <span className="flex-1">Event / Organizer</span>
          <span className="w-36">Requested</span>
          <span className="w-32">Submitted</span>
          <span className="w-44">Status</span>
          <span className="w-24" aria-hidden />
        </div>
        {visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No events in this view.
          </p>
        ) : (
          visible.map((r) => {
            const pill = STATE_PILL[r.state];
            return (
              <div
                key={r.id}
                className="flex items-center gap-4 border-t border-border px-6 py-3.5"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {r.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.organizerName}
                  </span>
                </div>
                <span className="w-36 text-sm text-foreground">
                  {r.suggestedCredits != null
                    ? `${r.suggestedCredits.toFixed(0)} credits`
                    : "—"}
                  {r.categoryLabel ? ` · ${r.categoryLabel}` : ""}
                </span>
                <span className="w-32 font-mono text-[13px] text-muted-foreground">
                  {r.submittedAt
                    ? format(parseISO(r.submittedAt), "dd MMM yyyy")
                    : "—"}
                </span>
                <span className="w-44">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-xs",
                      pill.className
                    )}
                  >
                    {pill.label}
                  </span>
                </span>
                <span className="w-24">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/committee/events/${r.id}`}
                      aria-label={`Review ${r.title}`}
                    >
                      Review
                    </Link>
                  </Button>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
