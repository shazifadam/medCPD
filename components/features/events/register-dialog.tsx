"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CalendarPlus } from "lucide-react";
import type { EventCard } from "@/lib/events";
import {
  registerForEventAction,
  type EventActionState,
} from "@/app/(portal)/events/actions";
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

/** EV4 — register confirm dialog. Success closes and refreshes (EV5). */
export function RegisterDialog({ event }: { event: EventCard }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<EventActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await registerForEventAction(event.id);
      setState(result);
      if (result.status === "success") {
        setOpen(false);
        router.refresh();
      }
    });
  }

  const creditLine = [
    event.credits != null ? `${event.credits.toFixed(1)} credits` : null,
    event.categoryLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus className="mr-1.5 h-4 w-4" aria-hidden />
          Register
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-primary">
            <CalendarPlus className="h-5 w-5" aria-hidden />
          </div>
          <DialogTitle>Register for this event?</DialogTitle>
          <DialogDescription>
            You&apos;ll be added to the roster for {event.title} (
            {format(parseISO(event.startsAt), "d MMM yyyy")}). Check in at the
            venue{creditLine ? ` to earn ${creditLine}` : ""}.
          </DialogDescription>
        </DialogHeader>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-status-rejected">
            {state.error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={pending}>
            {pending ? "Registering…" : "Confirm registration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
