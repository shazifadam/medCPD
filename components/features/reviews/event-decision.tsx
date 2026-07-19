"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  reviewEventAction,
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

export interface CategoryOption {
  id: string;
  name: string;
}

interface Shared {
  eventId: string;
  eventTitle: string;
  organizerName: string;
}

/** ER3 side panel — Approve & allocate / Request revisions / Reject. */
export function EventDecision(props: Shared & {
  suggestedCredits: number | null;
  categoryId: string | null;
  categoryName: string | null;
  cycleName: string | null;
  categories: CategoryOption[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <ApproveDialog {...props} />
      <RevisionsDialog {...props} />
      <RejectDialog {...props} />
    </div>
  );
}

/** ER6 — Request revisions (lands on rejected per schema 4d; org resubmits). */
function RevisionsDialog(props: Shared) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<CommitteeActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  const AREAS = [
    "Agenda / session breakdown",
    "Credit justification & learning outcomes",
    "Speaker credentials",
  ];

  function toggle(area: string) {
    setAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  function confirm() {
    startTransition(async () => {
      const result = await reviewEventAction({
        eventId: props.eventId,
        decision: "revisions",
        comments: [
          areas.length ? `Needs revision: ${areas.join(", ")}` : null,
          message.trim() || null,
        ]
          .filter(Boolean)
          .join(" — "),
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
          Request revisions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Request revisions</DialogTitle>
          <DialogDescription>
            {props.eventTitle} · {props.organizerName}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="pb-1 text-sm font-medium text-foreground">
              What needs revision?
            </legend>
            {AREAS.map((area) => (
              <label
                key={area}
                className="flex items-center gap-2.5 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={areas.includes(area)}
                  onChange={() => toggle(area)}
                  className="h-4 w-4 accent-primary"
                />
                {area}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="revision-message"
              className="text-sm font-medium text-foreground"
            >
              Message to organizer
            </label>
            <Textarea
              id="revision-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please add a detailed session breakdown…"
              className="h-20 resize-none"
            />
          </div>
          <p className="rounded-md bg-accent px-4 py-2.5 text-sm text-primary">
            The organizer can update the request and resubmit it for review.
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
            disabled={pending || (areas.length === 0 && !message.trim())}
          >
            {pending ? "Sending…" : "Send revision request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ER5 — Reject accreditation request. */
function RejectDialog(props: Shared) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<CommitteeActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  const REASONS = [
    "Does not meet CPD accreditation criteria",
    "Insufficient educational content",
    "Sponsored / promotional content — not eligible",
    "Other",
  ];

  function confirm() {
    startTransition(async () => {
      const result = await reviewEventAction({
        eventId: props.eventId,
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
          <DialogTitle>Reject accreditation request</DialogTitle>
          <DialogDescription>
            {props.eventTitle} · {props.organizerName}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="event-rejection-reason"
              className="text-sm font-medium text-foreground"
            >
              Reason for rejection
            </label>
            <Select value={reason || undefined} onValueChange={setReason}>
              <SelectTrigger
                id="event-rejection-reason"
                aria-label="Reason for rejection"
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
              htmlFor="event-rejection-details"
              className="text-sm font-medium text-foreground"
            >
              Details for the organizer
            </label>
            <Textarea
              id="event-rejection-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Explain why this request is being rejected and what would be required for a future submission…"
              className="h-24 resize-none"
            />
          </div>
          <p className="rounded-md bg-status-rejected-bg px-4 py-2.5 text-sm text-status-rejected">
            The organizer will be notified and this event will not be
            accredited.
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
            {pending ? "Rejecting…" : "Reject request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ER4 — Approve & allocate credits. */
function ApproveDialog(props: Shared & {
  suggestedCredits: number | null;
  categoryId: string | null;
  categoryName: string | null;
  cycleName: string | null;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(
    props.suggestedCredits != null ? String(props.suggestedCredits) : ""
  );
  const [categoryId, setCategoryId] = useState(props.categoryId ?? "");
  const [state, setState] = useState<CommitteeActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await reviewEventAction({
        eventId: props.eventId,
        decision: "approve",
        credits: Number(credits),
        categoryId,
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
        <Button className="w-full">Approve &amp; allocate credits</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Approve &amp; allocate credits</DialogTitle>
          <DialogDescription>
            {props.eventTitle} · {props.organizerName}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-md bg-muted px-4 py-3 text-sm">
            <span className="text-muted-foreground">Requested</span>
            <span className="text-foreground">
              {props.suggestedCredits != null
                ? `${props.suggestedCredits.toFixed(0)} credits`
                : "Credits"}
              {props.categoryName ? ` · ${props.categoryName}` : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="alloc-credits"
                className="text-sm font-medium text-foreground"
              >
                Approved credits
              </label>
              <Input
                id="alloc-credits"
                inputMode="decimal"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                placeholder="e.g. 8"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="alloc-category"
                className="text-sm font-medium text-foreground"
              >
                Primary category
              </label>
              <Select value={categoryId || undefined} onValueChange={setCategoryId}>
                <SelectTrigger id="alloc-category" aria-label="Primary category">
                  <SelectValue placeholder="Select category" />
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
          {props.cycleName && (
            <p className="text-sm text-muted-foreground">
              Effective cycle: {props.cycleName}
            </p>
          )}
          <p className="rounded-md bg-accent px-4 py-2.5 text-sm text-primary">
            Once published, these credits become claimable by all verified
            attendees of this event.
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
            disabled={pending || !credits || !categoryId}
          >
            {pending ? "Approving…" : "Approve & accredit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
