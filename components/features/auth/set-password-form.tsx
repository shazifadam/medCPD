"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Lock } from "lucide-react";
import { setPasswordSchema, type SetPasswordInput } from "@/lib/schemas";
import {
  setPasswordAction,
  type SetPasswordState,
} from "@/app/(auth)/set-password/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthCard, AuthHeading } from "./auth-card";

/** AU8 — Set a new password. Fields carry the lock icon per the frame. */
export function SetPasswordForm() {
  const [state, setState] = useState<SetPasswordState>({ error: null });
  const [pending, startTransition] = useTransition();

  const form = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  function onSubmit(values: SetPasswordInput) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("password", values.password);
      fd.set("confirmPassword", values.confirmPassword);
      // On success the action redirect()s and resolves undefined — only
      // error states come back as values.
      const result = await setPasswordAction({ error: null }, fd);
      if (result) setState(result);
    });
  }

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <AuthHeading
        title="Set a new password"
        subtitle="Choose a strong password for your account"
      />
      <AuthCard>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            noValidate
          >
            {state.error && (
              <div
                role="alert"
                className="flex gap-3 rounded-md border border-status-rejected-border/40 bg-status-rejected-bg px-4 py-3 text-sm text-status-rejected"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden
                />
                <p>{state.error}</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        className="pl-9"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                        className="pl-9"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Form>
      </AuthCard>
    </div>
  );
}
