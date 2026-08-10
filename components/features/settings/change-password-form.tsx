"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  changePasswordAction,
  type SettingsActionState,
} from "@/app/(portal)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Change password (settings → security). */
export function ChangePasswordForm() {
  const [state, setState] = useState<SettingsActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await changePasswordAction(
        { status: "idle", error: null },
        fd
      );
      setState(result);
      if (result.status === "success") form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-4">
      {state.error && (
        <div
          role="alert"
          className="flex gap-2 rounded-md border border-status-rejected-border/40 bg-status-rejected-bg px-3 py-2 text-sm text-status-rejected"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.error}
        </div>
      )}
      {state.status === "success" && (
        <div className="rounded-md border border-status-approved-border bg-status-approved-bg px-3 py-2 text-sm text-status-approved">
          Password updated.
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="st-password" className="text-sm font-medium">
          New password
        </label>
        <Input
          id="st-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="st-confirm" className="text-sm font-medium">
          Confirm new password
        </label>
        <Input
          id="st-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <div>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Updating password…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </div>
    </form>
  );
}
