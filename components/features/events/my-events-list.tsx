"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { MyEventRow } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { CheckInDialog } from "./check-in-dialog";

type Tab = "upcoming" | "past" | "pending";

const TABS: { key: Tab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "pending", label: "Pending verification" },
];

const STATE_PILL: Record<
  MyEventRow["state"],
  { label: string; className: string }
> = {
  registered: {
    label: "Registered",
    className:
      "border-status-under-review-border bg-status-under-review-bg text-status-under-review",
  },
  checked_in: {
    label: "Checked in",
    className:
      "border-status-approved-border bg-status-approved-bg text-status-approved",
  },
  pending_verification: {
    label: "Pending verification",
    className:
      "border-status-pending-border bg-status-pending-bg text-status-pending",
  },
  no_credit: {
    label: "No credit",
    className:
      "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
  },
};

/** AT1 — registered-events rows with per-state pills and actions. */
export function MyEventsList({ rows }: { rows: MyEventRow[] }) {
  const [tab, setTab] = useState<Tab>("upcoming");

  const counts = useMemo(
    () => ({
      upcoming: rows.filter((r) => !r.isPast).length,
      past: rows.filter((r) => r.isPast).length,
      pending: rows.filter((r) => r.state === "pending_verification").length,
    }),
    [rows]
  );

  const visible = useMemo(
    () =>
      rows.filter((r) =>
        tab === "upcoming"
          ? !r.isPast
          : tab === "past"
            ? r.isPast
            : r.state === "pending_verification"
      ),
    [rows, tab]
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Filter my events"
        className="flex items-center gap-1 border-b border-border"
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm",
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-2 py-px text-xs",
                  active
                    ? "bg-accent text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-6 py-16 text-center">
          <p className="text-base font-semibold text-foreground">
            Nothing here yet
          </p>
          <p className="text-sm text-muted-foreground">
            Events you register for will appear here.
          </p>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/events">Browse events</Link>
          </Button>
        </div>
      ) : (
        visible.map((r) => {
          const starts = parseISO(r.startsAt);
          const pill = STATE_PILL[r.state];
          return (
            <div
              key={r.eventId}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-accent">
                <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                  {format(starts, "MMM")}
                </span>
                <span className="text-xl font-semibold text-foreground">
                  {format(starts, "d")}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                  href={`/events/${r.eventId}`}
                  className="truncate text-base font-semibold text-foreground hover:text-primary"
                >
                  {r.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {[
                    format(starts, "d MMM"),
                    `${format(starts, "h:mm a")} — ${format(parseISO(r.endsAt), "h:mm a")}`,
                    r.venueName,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {r.state === "checked_in" && r.credits != null ? (
                    <span className="text-status-approved">
                      +{r.credits.toFixed(0)} credits awarded
                    </span>
                  ) : (
                    `${r.credits != null ? `${r.credits.toFixed(0)} CPD credits` : "Credits TBD"}`
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-xs",
                    pill.className
                  )}
                >
                  {pill.label}
                </span>
                {r.state === "registered" && !r.isPast ? (
                  <CheckInDialog
                    eventId={r.eventId}
                    eventTitle={r.title}
                    eventVenue={r.venueName}
                  />
                ) : r.state === "checked_in" && r.entryId ? (
                  <Link
                    href={`/my-cpd/${r.entryId}`}
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    View entry
                  </Link>
                ) : (
                  <Button asChild variant="outline">
                    <Link href={`/events/${r.eventId}`}>View details</Link>
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
