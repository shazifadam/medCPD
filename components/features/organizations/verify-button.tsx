"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { verifyOrganizationAction } from "@/app/(portal)/organizations/actions";
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

/** Verify an organization (admin + committee) behind a confirm dialog. */
export function VerifyOrgButton({
  institutionId,
  name,
}: {
  institutionId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function verify() {
    startTransition(async () => {
      const result = await verifyOrganizationAction(institutionId);
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Verify ${name}`}>
          Verify
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify {name}?</DialogTitle>
          <DialogDescription>
            Marks this organization as a verified provider. Verified status is
            shown wherever the organization appears (events, workplaces,
            provider lists).
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-status-rejected">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button disabled={pending} onClick={verify} aria-busy={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Verifying…
              </>
            ) : (
              "Verify organization"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
