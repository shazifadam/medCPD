"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  revokeAccreditationAction,
  type CommitteeActionState,
} from "@/app/(portal)/committee/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REASONS = [
  "Sponsored / promotional content — not eligible",
  "Misrepresented agenda or credits",
  "Accreditation criteria no longer met",
  "Other",
];

/** AI3 — revoke an accreditation (withdraws claimed credits). */
export function RevokeDialog({
  accreditationId,
  eventTitle,
}: {
  accreditationId: string;
  eventTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<CommitteeActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await revokeAccreditationAction({
        accreditationId,
        reason,
        details,
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
        <Button variant="outline" size="sm" aria-label={`Revoke ${eventTitle}`}>
          Revoke
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-rejected-bg">
            <AlertTriangle
              className="h-5 w-5 text-status-rejected"
              aria-hidden
            />
          </div>
          <DialogTitle>Revoke accreditation</DialogTitle>
          <DialogDescription>{eventTitle}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="rounded-md bg-status-rejected-bg px-4 py-3 text-sm text-status-rejected">
            Revoking removes this event&apos;s CPD credits. Practitioners who
            claimed credits from it will have those credits withdrawn from
            their records.
          </p>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="revocation-reason"
              className="text-sm font-medium text-foreground"
            >
              Reason for revocation
            </label>
            <Select value={reason || undefined} onValueChange={setReason}>
              <SelectTrigger
                id="revocation-reason"
                aria-label="Reason for revocation"
              >
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="revocation-details"
              className="text-sm font-medium text-foreground"
            >
              Details
            </label>
            <Textarea
              id="revocation-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Why this accreditation no longer stands…"
              className="h-20 resize-none"
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
            variant="destructive"
            onClick={confirm}
            disabled={pending || !reason}
          >
            {pending ? "Revoking…" : "Revoke accreditation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
