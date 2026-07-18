"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { ApplicantRow, ApplicantState } from "@/lib/approvals";
import { Button } from "@/components/ui/button";

type Tab = "pending" | "verified" | "rejected" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const STATE_PILL: Record<ApplicantState, { label: string; className: string }> =
  {
    pending: {
      label: "Pending",
      className:
        "border-status-pending-border bg-status-pending-bg text-status-pending",
    },
    verified: {
      label: "Approved",
      className:
        "border-status-approved-border bg-status-approved-bg text-status-approved",
    },
    rejected: {
      label: "Rejected",
      className:
        "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
    },
  };

function registrationLabel(r: ApplicantRow): string {
  if (r.registrationType === "TMR") return "Temporary registration";
  if (r.registrationType === "PMR") return "Full registration";
  return "Registration";
}

/** RA1 — signup approval queue (tabs + applicant table). */
export function ApplicantsTable({ rows }: { rows: ApplicantRow[] }) {
  const [tab, setTab] = useState<Tab>("pending");

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.state === "pending").length,
      verified: rows.filter((r) => r.state === "verified").length,
      rejected: rows.filter((r) => r.state === "rejected").length,
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
      <div role="tablist" aria-label="Filter applicants" className="flex gap-2">
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
          <span className="flex-1">Applicant</span>
          <span className="w-52">Registration</span>
          <span className="w-32">Submitted</span>
          <span className="w-28">Status</span>
          <span className="w-24" aria-hidden />
        </div>
        {visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No applicants in this view.
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
                    {r.fullName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.email}
                  </span>
                </div>
                <div className="flex w-52 flex-col">
                  <span className="text-sm text-foreground">
                    {registrationLabel(r)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.registrationNumber ?? "—"}
                  </span>
                </div>
                <span className="w-32 font-mono text-[13px] text-muted-foreground">
                  {format(parseISO(r.submittedAt), "dd MMM yyyy")}
                </span>
                <span className="w-28">
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
                      href={`/admin/approvals/${r.id}`}
                      aria-label={`Review ${r.fullName}`}
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
