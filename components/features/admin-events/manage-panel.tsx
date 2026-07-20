"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  submitEventAction,
  cancelEventAction,
  type AdminEventActionState,
} from "@/app/(portal)/admin/events/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** EM5 — Manage panel: roster/attendance links + submit / cancel. */
export function ManagePanel({
  eventId,
  status,
}: {
  eventId: string;
  status: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<AdminEventActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await submitEventAction(eventId);
      setState(result);
      if (result.status === "success") router.refresh();
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelEventAction(eventId);
      setState(result);
      if (result.status === "success") router.refresh();
    });
  }

  const accredited = status === "approved" || status === "completed";

  return (
    <div className="flex flex-col gap-2.5">
      {accredited && (
        <>
          <Button asChild className="w-full">
            <Link href={`/admin/events/${eventId}/roster`}>View roster</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/admin/events/${eventId}/attendance`}>
              Verify attendance
            </Link>
          </Button>
        </>
      )}
      {(status === "draft" || status === "rejected") && (
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? "Submitting…" : "Submit for accreditation"}
        </Button>
      )}
      {status !== "cancelled" && status !== "completed" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              Cancel event
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this event?</AlertDialogTitle>
              <AlertDialogDescription>
                Registered practitioners will no longer be able to check in.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep event</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  cancel();
                }}
              >
                Cancel event
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-status-rejected">
          {state.error}
        </p>
      )}
    </div>
  );
}
