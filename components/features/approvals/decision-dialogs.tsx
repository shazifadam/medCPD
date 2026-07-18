"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import {
  approveApplicantAction,
  rejectApplicantAction,
  type ApprovalActionState,
} from "@/app/(portal)/admin/approvals/actions";
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

const REJECTION_REASONS = [
  "Registration could not be verified with MMDC",
  "Incomplete or unclear applicant details",
  "Duplicate application",
  "Other",
];

/** RA3 — approve confirm (role + starting cycle are fixed in v1). */
export function ApproveDialog({
  applicantId,
  applicantName,
  registrationNumber,
  cycleName,
}: {
  applicantId: string;
  applicantName: string;
  registrationNumber: string | null;
  cycleName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ApprovalActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await approveApplicantAction(applicantId);
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
        <Button className="w-full">Approve &amp; grant access</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-approved-bg">
            <Check className="h-5 w-5 text-status-approved" aria-hidden />
          </div>
          <DialogTitle>Approve registration</DialogTitle>
          <DialogDescription>
            {[applicantName, registrationNumber].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-md bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">Grants</span>
            <span className="text-foreground">
              Practitioner role · full access to the CPD portal
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-foreground">Assign role</span>
              <div className="flex h-10 items-center rounded-md border border-input px-3 text-foreground">
                Practitioner
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-foreground">
                Starting cycle
              </span>
              <div className="flex h-10 items-center rounded-md border border-input px-3 text-foreground">
                {cycleName ?? "Current cycle"}
              </div>
            </div>
          </div>
          <p className="rounded-md bg-accent px-4 py-2.5 text-sm text-primary">
            The applicant will receive a welcome email and can sign in
            immediately.
          </p>
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
          <Button onClick={confirm} disabled={pending}>
            {pending ? "Approving…" : "Approve & grant access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** RA4 — reject with reason + details for the applicant. */
export function RejectDialog({
  applicantId,
  applicantName,
  registrationNumber,
}: {
  applicantId: string;
  applicantName: string;
  registrationNumber: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<ApprovalActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await rejectApplicantAction(applicantId, reason, details);
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
        <Button variant="destructive" className="w-full">
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Reject application</DialogTitle>
          <DialogDescription>
            {[applicantName, registrationNumber].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="rejection-reason"
              className="text-sm font-medium text-foreground"
            >
              Reason for rejection
            </label>
            <Select value={reason || undefined} onValueChange={setReason}>
              <SelectTrigger id="rejection-reason" aria-label="Reason for rejection">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="rejection-details"
              className="text-sm font-medium text-foreground"
            >
              Details for the applicant
            </label>
            <Textarea
              id="rejection-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Explain what the applicant should correct…"
              className="h-24 resize-none"
            />
          </div>
          <p className="rounded-md bg-status-rejected-bg px-4 py-2.5 text-sm text-status-rejected">
            The applicant will be notified and can re-apply with corrected
            details.
          </p>
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
            {pending ? "Rejecting…" : "Reject application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
