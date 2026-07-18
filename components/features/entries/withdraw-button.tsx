"use client";

import { useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { withdrawEntryAction } from "@/app/(portal)/my-cpd/[id]/actions";
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

/** EN5 trigger + EN7 confirm — withdraw a pending entry. */
export function WithdrawButton({ entryId }: { entryId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Withdraw entry
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertTriangle className="h-7 w-7 text-status-rejected" aria-hidden />
          <AlertDialogTitle>Withdraw this entry?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be removed from the review queue. You can log it again
            later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              startTransition(() => withdrawEntryAction(entryId));
            }}
          >
            {pending ? "Withdrawing…" : "Withdraw"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
