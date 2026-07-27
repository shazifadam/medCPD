"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  issueCertificateAction,
  type CertificateActionState,
} from "@/app/(portal)/admin/certificates/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface IssueOption {
  id: string;
  label: string;
}

/**
 * CA2 — manually issue a certificate. Deviations from the frame, deliberate:
 * issue date is stamped server-side (now) rather than picked, and the
 * linked-cycle option issues for the current cycle.
 */
export function IssueDialog({
  practitioners,
  events,
}: {
  practitioners: IssueOption[];
  events: IssueOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [practitionerId, setPractitionerId] = useState("");
  const [kind, setKind] = useState<"event_attendance" | "cycle_completion">(
    "event_attendance"
  );
  const [eventId, setEventId] = useState("");
  const [credits, setCredits] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<CertificateActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await issueCertificateAction({
        practitionerId,
        kind,
        eventId: eventId || undefined,
        credits: credits === "" ? undefined : Number(credits),
        note: note || undefined,
      });
      setState(result);
      if (result.status === "success") {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Issue certificate</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Issue certificate</DialogTitle>
          <DialogDescription>
            Manually issue a CPD certificate to a practitioner
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issue-practitioner">Practitioner</Label>
            <Select value={practitionerId} onValueChange={setPractitionerId}>
              <SelectTrigger id="issue-practitioner">
                <SelectValue placeholder="Select practitioner" />
              </SelectTrigger>
              <SelectContent>
                {practitioners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-kind">Certificate type</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as typeof kind)}
              >
                <SelectTrigger id="issue-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event_attendance">Event</SelectItem>
                  <SelectItem value="cycle_completion">
                    Cycle completion
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-event">Linked event / cycle</Label>
              {kind === "event_attendance" ? (
                <Select value={eventId} onValueChange={setEventId}>
                  <SelectTrigger id="issue-event">
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input id="issue-event" value="Current cycle" readOnly />
              )}
            </div>
          </div>

          {kind === "event_attendance" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-credits">Credits</Label>
              <Input
                id="issue-credits"
                type="number"
                min="0"
                step="0.5"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                placeholder="8.0"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issue-note">Reason / note</Label>
            <Textarea
              id="issue-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Re-issued after attendance was verified manually"
            />
          </div>

          {state.status === "error" && (
            <p role="alert" className="text-sm text-status-rejected">
              {state.error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending || !practitionerId}
          >
            {pending ? "Issuing…" : "Issue certificate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
