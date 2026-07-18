"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, Clock, QrCode } from "lucide-react";
import {
  checkInAction,
  type CheckInResult,
} from "@/app/(portal)/events/checkin-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * AT2 — check-in dialog (QR panel + attestation), then swaps to the result:
 * AT3 credits awarded · AT4 pending verification · AT5 no-credit notice.
 */
export function CheckInDialog({
  eventId,
  eventTitle,
  eventVenue,
}: {
  eventId: string;
  eventTitle: string;
  eventVenue: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [attested, setAttested] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      setResult(await checkInAction(eventId));
    });
  }

  function done() {
    setOpen(false);
    setResult(null);
    setAttested(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) done();
      }}
    >
      <DialogTrigger asChild>
        <Button>Check in</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[460px]">
        {result == null ? (
          <>
            <DialogHeader>
              <DialogTitle>Check in to event</DialogTitle>
              <DialogDescription>
                {[eventTitle, eventVenue].filter(Boolean).join(" · ")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex h-44 w-44 items-center justify-center rounded-md bg-accent">
                <QrCode className="h-24 w-24 text-foreground" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground">
                Scan the QR code displayed at the venue
              </p>
              <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden />
                or
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>
              <label className="flex w-full items-center gap-3 rounded-md border border-border px-4 py-3 text-sm text-foreground">
                <Checkbox
                  checked={attested}
                  onCheckedChange={(v) => setAttested(v === true)}
                />
                I attest that I attended this session in full.
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={done}>
                Cancel
              </Button>
              <Button onClick={confirm} disabled={!attested || pending}>
                {pending ? "Checking in…" : "Confirm check-in"}
              </Button>
            </DialogFooter>
          </>
        ) : result.outcome === "error" ? (
          <>
            <DialogHeader>
              <DialogTitle>Couldn&apos;t check in</DialogTitle>
              <DialogDescription>{result.error}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button className="w-full" onClick={done}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <ResultView result={result} eventTitle={eventTitle} onDone={done} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultView({
  result,
  eventTitle,
  onDone,
}: {
  result: CheckInResult;
  eventTitle: string;
  onDone: () => void;
}) {
  const kind = result.outcome;
  return (
    <div className="flex flex-col items-center gap-4 pt-2 text-center">
      {kind === "awarded" && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-approved-bg">
          <Check className="h-8 w-8 text-status-approved" aria-hidden />
        </div>
      )}
      {kind === "pending" && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-pending-bg">
          <Clock className="h-8 w-8 text-status-pending" aria-hidden />
        </div>
      )}
      {kind === "no_credit" && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-rejected-bg">
          <AlertTriangle className="h-8 w-8 text-status-rejected" aria-hidden />
        </div>
      )}

      <DialogTitle>
        {kind === "awarded"
          ? "Checked in successfully"
          : kind === "pending"
            ? "Attendance recorded — pending verification"
            : "No credit for this event"}
      </DialogTitle>
      <DialogDescription>
        {kind === "awarded"
          ? "Your attendance for this event has been recorded and CPD credits added to your record."
          : kind === "pending"
            ? "Your check-in is recorded. CPD credits will be added once the event organizer verifies the attendance list."
            : "You didn't pre-register for this event, so no CPD credit can be awarded for your attendance. Contact the organizer if you believe this is an error."}
      </DialogDescription>

      <div className="flex w-full flex-col gap-1 rounded-md bg-muted px-4 py-3">
        <p className="text-sm font-medium text-foreground">{eventTitle}</p>
        <p
          className={
            kind === "awarded"
              ? "font-mono text-xs text-status-approved"
              : kind === "pending"
                ? "font-mono text-xs text-status-pending"
                : "font-mono text-xs text-status-rejected"
          }
        >
          {kind === "awarded"
            ? `+${result.credits?.toFixed(0) ?? 0} CPD credits awarded`
            : kind === "pending"
              ? "Awaiting organizer verification"
              : "No credit — not pre-registered"}
        </p>
      </div>

      <div className="flex w-full gap-3">
        <Button asChild variant="outline" className="flex-1">
          <Link href={kind === "awarded" ? "/my-cpd" : "/events/my"}>
            {kind === "awarded" ? "View my entries" : "View my events"}
          </Link>
        </Button>
        <Button className="flex-1" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
