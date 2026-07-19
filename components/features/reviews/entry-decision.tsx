"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  reviewEntryAction,
  type CommitteeActionState,
} from "@/app/(portal)/committee/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  "Evidence does not support the claimed activity",
  "Activity is not CPD-eligible",
  "Duplicate entry",
  "Other",
];

export interface CategoryOption {
  id: string;
  name: string;
}

/** IR2 side panel — Approve as claimed / Adjust credits / Reject. */
export function EntryDecision({
  entryId,
  entryTitle,
  practitionerName,
  claimedCredits,
  claimedCategoryName,
  categoryId,
  categories,
}: {
  entryId: string;
  entryTitle: string;
  practitionerName: string;
  claimedCredits: number;
  claimedCategoryName: string;
  categoryId: string;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [state, setState] = useState<CommitteeActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function approveAsClaimed() {
    startTransition(async () => {
      const result = await reviewEntryAction({ entryId, decision: "approve" });
      setState(result);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Button className="w-full" onClick={approveAsClaimed} disabled={pending}>
        {pending ? "Working…" : "Approve as claimed"}
      </Button>
      <AdjustDialog
        entryId={entryId}
        entryTitle={entryTitle}
        practitionerName={practitionerName}
        claimedCredits={claimedCredits}
        claimedCategoryName={claimedCategoryName}
        categoryId={categoryId}
        categories={categories}
      />
      <RejectDialog
        entryId={entryId}
        entryTitle={entryTitle}
        practitionerName={practitionerName}
      />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-status-rejected">
          {state.error}
        </p>
      )}
    </div>
  );
}

/** IR3 — Adjust & approve credits. */
function AdjustDialog(props: {
  entryId: string;
  entryTitle: string;
  practitionerName: string;
  claimedCredits: number;
  claimedCategoryName: string;
  categoryId: string;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState("");
  const [categoryId, setCategoryId] = useState(props.categoryId);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<CommitteeActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await reviewEntryAction({
        entryId: props.entryId,
        decision: "adjust",
        credits: Number(credits),
        categoryId,
        comments: reason,
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
        <Button variant="outline" className="w-full">
          Adjust credits
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Adjust &amp; approve credits</DialogTitle>
          <DialogDescription>
            {props.entryTitle} · {props.practitionerName}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-md bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">Claimed</span>
            <span className="text-foreground">
              {props.claimedCredits.toFixed(1)} credits ·{" "}
              {props.claimedCategoryName}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="approved-credits"
                className="text-sm font-medium text-foreground"
              >
                Approved credits
              </label>
              <Input
                id="approved-credits"
                inputMode="decimal"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                placeholder={props.claimedCredits.toFixed(1)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="approved-category"
                className="text-sm font-medium text-foreground"
              >
                Category
              </label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="approved-category" aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {props.categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="adjustment-reason"
              className="text-sm font-medium text-foreground"
            >
              Adjustment reason
            </label>
            <Textarea
              id="adjustment-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are the approved credits different from the claim…"
              className="h-20 resize-none"
            />
          </div>
          <p className="rounded-md bg-accent px-4 py-2.5 text-sm text-primary">
            The practitioner will be notified of the approved credits and this
            note.
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
            onClick={confirm}
            disabled={pending || !credits || !reason.trim()}
          >
            {pending ? "Approving…" : "Approve entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** IR4 — Reject entry with reason. */
function RejectDialog(props: {
  entryId: string;
  entryTitle: string;
  practitionerName: string;
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
      const result = await reviewEntryAction({
        entryId: props.entryId,
        decision: "reject",
        comments: [reason, details.trim()].filter(Boolean).join(" — "),
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
        <Button variant="destructive" className="w-full">
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Reject entry</DialogTitle>
          <DialogDescription>
            {props.entryTitle} · {props.practitionerName}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="entry-rejection-reason"
              className="text-sm font-medium text-foreground"
            >
              Reason for rejection
            </label>
            <Select value={reason || undefined} onValueChange={setReason}>
              <SelectTrigger
                id="entry-rejection-reason"
                aria-label="Reason for rejection"
              >
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
              htmlFor="entry-rejection-details"
              className="text-sm font-medium text-foreground"
            >
              Details for the practitioner
            </label>
            <Textarea
              id="entry-rejection-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Explain what the practitioner should correct…"
              className="h-24 resize-none"
            />
          </div>
          <p className="rounded-md bg-status-rejected-bg px-4 py-2.5 text-sm text-status-rejected">
            The practitioner will be notified and no credits will be awarded
            for this entry.
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
            {pending ? "Rejecting…" : "Reject entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
