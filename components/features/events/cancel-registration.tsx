"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelRegistrationAction } from "@/app/(portal)/events/actions";

/** EV5 — "Cancel registration" text action under the Registered button. */
export function CancelRegistrationButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await cancelRegistrationAction(eventId);
          router.refresh();
        })
      }
      className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {pending ? "Cancelling…" : "Cancel registration"}
    </button>
  );
}
