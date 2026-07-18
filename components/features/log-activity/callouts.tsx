"use client";

import { AlertTriangle, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";

/** LA5 — destructive validation callout at the top of the form. */
export function ValidationCallout({ message }: { message?: string | null }) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-md border border-status-rejected-border/40 bg-status-rejected-bg p-4 text-sm text-status-rejected"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-medium">
          {message ?? "Please complete the required fields."}
        </p>
        <p>Some details are missing before you can submit.</p>
      </div>
    </div>
  );
}

/** LA6 — amber pre-registration gate callout. */
export function PreRegCallout({ subcategoryCode }: { subcategoryCode: string | null }) {
  const sub = subcategoryCode ? `(CAT${subcategoryCode.charAt(0)} ${subcategoryCode})` : "";
  return (
    <div
      role="status"
      className="flex gap-3 rounded-md border border-status-pending-border bg-status-pending-bg p-4 text-sm text-status-pending"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-medium">No credit will be awarded</p>
        <p>
          This activity&apos;s sub-category {sub} requires pre-registration. You
          can still log it for your record, but it won&apos;t count toward your
          cycle.
        </p>
      </div>
    </div>
  );
}

/** LA7 — success dialog body (small, centered, full-width Done). */
export function SuccessView({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 pt-2 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-approved-bg">
        <CircleCheck className="h-8 w-8 text-success" aria-hidden />
      </div>
      <div className="flex flex-col gap-2">
        <DialogTitle className="text-lg font-semibold text-foreground">
          Activity submitted
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Your entry is pending review. You&apos;ll be notified once it&apos;s
          approved.
        </p>
      </div>
      <Button className="w-full" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
