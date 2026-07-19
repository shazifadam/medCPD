"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { ReviewQueueRow } from "@/lib/reviews";
import { StatusBadge } from "@/components/features/entries/status-badge";
import { Button } from "@/components/ui/button";

type Tab = "pending" | "approved" | "rejected" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

/** IR1 — entry review queue (pill tabs + practitioner/activity table). */
export function EntryQueue({ rows }: { rows: ReviewQueueRow[] }) {
  const [tab, setTab] = useState<Tab>("pending");

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
      all: rows.length,
    }),
    [rows]
  );

  const visible = useMemo(
    () => rows.filter((r) => tab === "all" || r.status === tab),
    [rows, tab]
  );

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Filter entries" className="flex gap-2">
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
          <span className="flex-1">Practitioner / Activity</span>
          <span className="w-40">Credits claimed</span>
          <span className="w-32">Submitted</span>
          <span className="w-36">Status</span>
          <span className="w-24" aria-hidden />
        </div>
        {visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No entries in this view.
          </p>
        ) : (
          visible.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 border-t border-border px-6 py-3.5"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {r.title}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[r.practitionerName, r.practitionerMmdc, r.categoryLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <span className="w-40 text-sm text-foreground">
                {r.credits.toFixed(1)} credits · {r.categoryLabel}
              </span>
              <span className="w-32 font-mono text-[13px] text-muted-foreground">
                {format(parseISO(r.submittedAt), "dd MMM yyyy")}
              </span>
              <span className="w-36">
                <StatusBadge status={r.status} />
              </span>
              <span className="w-24">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/committee/entries/${r.id}`}
                    aria-label={`Review ${r.title}`}
                  >
                    Review
                  </Link>
                </Button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
