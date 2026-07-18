"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/schemas";
import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "@/app/(auth)/forgot-password/actions";
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

/** AU7 — Forgot password: email in, reset link out (lands on AU8). */
export function ForgotPasswordForm() {
  const [state, setState] = useState<ForgotPasswordState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: ForgotPasswordInput) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("email", values.email);
      setState(await forgotPasswordAction({ status: "idle", error: null }, fd));
    });
  }

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <AuthHeading
        title="Reset your password"
        subtitle="Enter your email and we'll send a reset link"
      />
      <AuthCard>
        {state.status === "sent" ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary text-primary">
              <MailCheck className="h-5 w-5" aria-hidden />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Check your email
              </h2>
              <p className="text-sm text-muted-foreground">
                If an account exists for that address, a password reset link
                is on its way.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-5"
              noValidate
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.mv"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Sending…" : "Send reset link"}
              </Button>

              <p className="text-center text-sm">
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline"
                >
                  Back to sign in
                </Link>
              </p>
            </form>
          </Form>
        )}
      </AuthCard>
    </div>
  );
}
