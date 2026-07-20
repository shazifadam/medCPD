"use client";

import { useState, useTransition } from "react";
import {
  createEventAction,
  type AdminEventActionState,
} from "@/app/(portal)/admin/events/actions";
import type { ActivityTypeOption } from "@/lib/activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * EM1–EM4 (compressed to one form — deliberate deviation, wizard steps
 * noted in dev log): details + capacity; sessions are added post-creation.
 */
export function CreateEventForm({
  activityTypes,
}: {
  activityTypes: ActivityTypeOption[];
}) {
  const [activityTypeId, setActivityTypeId] = useState("");
  const [state, setState] = useState<AdminEventActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("activityTypeId", activityTypeId);
    startTransition(async () => {
      const result = await createEventAction(
        { status: "idle", error: null },
        fd
      );
      // Success redirects server-side; only errors resolve here.
      if (result) setState(result);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6"
      noValidate
    >
      <h2 className="border-b border-border pb-3 text-lg font-semibold text-foreground">
        Event details
      </h2>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-md bg-status-rejected-bg px-4 py-2.5 text-sm text-status-rejected"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ev-title" className="text-sm font-medium text-foreground">
          Event title
        </label>
        <Input
          id="ev-title"
          name="title"
          placeholder="e.g. Advanced Cardiac Life Support 2026"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ev-type"
            className="text-sm font-medium text-foreground"
          >
            Activity type
          </label>
          <Select value={activityTypeId} onValueChange={setActivityTypeId}>
            <SelectTrigger id="ev-type" aria-label="Activity type">
              <SelectValue placeholder="Select activity type" />
            </SelectTrigger>
            <SelectContent>
              {activityTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.categoryLabel} · {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ev-venue"
            className="text-sm font-medium text-foreground"
          >
            Venue
          </label>
          <Input id="ev-venue" name="venue" placeholder="e.g. ADK Hospital, Malé" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ev-start"
            className="text-sm font-medium text-foreground"
          >
            Starts
          </label>
          <Input id="ev-start" name="startsAt" type="datetime-local" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ev-end" className="text-sm font-medium text-foreground">
            Ends
          </label>
          <Input id="ev-end" name="endsAt" type="datetime-local" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ev-capacity"
            className="text-sm font-medium text-foreground"
          >
            Capacity
          </label>
          <Input
            id="ev-capacity"
            name="capacity"
            inputMode="numeric"
            placeholder="e.g. 120"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="ev-description"
          className="text-sm font-medium text-foreground"
        >
          Description
        </label>
        <Textarea
          id="ev-description"
          name="description"
          placeholder="Describe the event, its objectives and target audience…"
          className="h-24 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button asChild variant="outline">
          <a href="/admin/events">Cancel</a>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
