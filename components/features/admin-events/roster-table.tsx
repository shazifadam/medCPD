"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { RosterRow } from "@/lib/admin-events";
import { removeRegistrationAction } from "@/app/(portal)/admin/events/actions";
import { Button } from "@/components/ui/button";

type Tab = "confirmed" | "waitlisted" | "cancelled";

const TABS: { key: Tab; label: string }[] = [
  { key: "confirmed", label: "Registered" },
  { key: "waitlisted", label: "Waitlist" },
  { key: "cancelled", label: "Cancelled" },
];

/** EM6 — roster with status tabs + remove. */
export function RosterTable({ rows }: { rows: RosterRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("confirmed");
  const [pending, startTransition] = useTransition();

  const counts = useMemo(
    () => ({
      confirmed: rows.filter((r) => r.status === "confirmed").length,
      waitlisted: rows.filter((r) => r.status === "waitlisted").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
    }),
    [rows]
  );
  const visible = rows.filter((r) => r.status === tab);

  function remove(registrationId: string) {
    startTransition(async () => {
      await removeRegistrationAction(registrationId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Filter roster" className="flex gap-2">
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
          <span className="flex-1">Practitioner</span>
          <span className="w-36">Registered on</span>
          <span className="w-32">Status</span>
          <span className="w-24" aria-hidden />
        </div>
        {visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Nobody in this view.
          </p>
        ) : (
          visible.map((r) => (
            <div
              key={r.registrationId}
              className="flex items-center gap-4 border-t border-border px-6 py-3.5"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {r.fullName}
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {r.mmdc ?? "—"}
                </span>
              </div>
              <span className="w-36 font-mono text-[13px] text-muted-foreground">
                {format(parseISO(r.registeredAt), "dd MMM yyyy")}
              </span>
              <span className="w-32">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-xs",
                    r.status === "confirmed"
                      ? "border-status-approved-border bg-status-approved-bg text-status-approved"
                      : r.status === "waitlisted"
                        ? "border-status-pending-border bg-status-pending-bg text-status-pending"
                        : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {r.status === "confirmed"
                    ? "Registered"
                    : r.status === "waitlisted"
                      ? "Waitlisted"
                      : "Cancelled"}
                </span>
              </span>
              <span className="w-24 text-right">
                {r.status !== "cancelled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => remove(r.registrationId)}
                    aria-label={`Remove ${r.fullName}`}
                  >
                    Remove
                  </Button>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
