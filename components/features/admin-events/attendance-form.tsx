"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import type { RosterRow } from "@/lib/admin-events";
import { verifyAttendanceAction } from "@/app/(portal)/admin/events/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * EM7 — verify attendance & award credits. Self check-ins (pending or
 * verified attendance rows) come pre-ticked per the design.
 */
export function AttendanceForm({
  eventId,
  rows,
}: {
  eventId: string;
  rows: RosterRow[];
}) {
  const router = useRouter();
  const eligible = useMemo(
    () => rows.filter((r) => r.status === "confirmed"),
    [rows]
  );
  const [ticked, setTicked] = useState<Set<string>>(
    () =>
      new Set(
        eligible
          .filter((r) => r.attendanceStatus != null)
          .map((r) => r.practitionerId)
      )
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(pid: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  function verify() {
    startTransition(async () => {
      const result = await verifyAttendanceAction(
        eventId,
        Array.from(ticked)
      );
      if (result.status === "error") setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {ticked.size} of {eligible.length} marked attended
        </p>
        <Button
          variant="outline"
          onClick={() => setTicked(new Set(eligible.map((r) => r.practitionerId)))}
        >
          Mark all attended
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-status-rejected-bg px-4 py-2.5 text-sm text-status-rejected"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex gap-4 rounded-t-lg bg-muted px-6 py-2.5 text-xs text-muted-foreground">
          <span className="flex-1">Practitioner</span>
          <span className="w-40">Checked in</span>
          <span className="w-28">Attendance</span>
        </div>
        {eligible.map((r) => (
          <label
            key={r.practitionerId}
            className="flex cursor-pointer items-center gap-4 border-t border-border px-6 py-3.5 hover:bg-muted/50"
          >
            <Checkbox
              checked={ticked.has(r.practitionerId)}
              onCheckedChange={() => toggle(r.practitionerId)}
              aria-label={`Mark ${r.fullName} attended`}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {r.fullName}
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {r.mmdc ?? "—"}
              </span>
            </span>
            <span className="w-40 font-mono text-[13px] text-muted-foreground">
              {r.checkedInAt
                ? format(parseISO(r.checkedInAt), "d MMM · HH:mm")
                : "–"}
            </span>
            <span className="w-28 text-sm">
              {r.attendanceStatus === "verified" ? (
                <span className="text-status-approved">Attended</span>
              ) : r.attendanceStatus === "pending" ? (
                <span className="text-status-pending">Self check-in</span>
              ) : (
                <span className="text-muted-foreground">Not marked</span>
              )}
            </span>
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={verify} disabled={pending || ticked.size === 0}>
          {pending
            ? "Verifying…"
            : `Verify & award credits to ${ticked.size}`}
        </Button>
      </div>
    </div>
  );
}
