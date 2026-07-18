"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check } from "lucide-react";
import { signUpSchema, type SignUpInput } from "@/lib/schemas";
import { signUpAction, type SignUpState } from "@/app/(auth)/signup/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthCard, AuthHeading } from "./auth-card";

export interface SpecialtyOption {
  id: string;
  name: string;
}

export function SignUpForm({
  specialties,
}: {
  specialties: SpecialtyOption[];
}) {
  const [state, setState] = useState<SignUpState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      specialtyId: "",
      mmdcRegistration: "",
      mmdcRegistrationType: undefined,
      email: "",
      phone: "",
    },
  });

  function onSubmit(values: SignUpInput) {
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => fd.set(k, v ?? ""));
      setState(await signUpAction({ status: "idle", error: null }, fd));
    });
  }

  // AU5 — success (pending approval)
  if (state.status === "success") {
    return (
      <AuthCard className="max-w-[400px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-status-approved text-status-approved">
            <Check className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-semibold text-foreground">
              Account created
            </h1>
            <p className="text-sm text-muted-foreground">
              Your registration is pending MMA review. We&apos;ll email you
              once it&apos;s approved.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  // AU4 — top callout on server error or failed client validation
  const showCallout =
    state.status === "error" ||
    (form.formState.submitCount > 0 && !form.formState.isValid);

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <AuthHeading
        title="Create your account"
        subtitle="Register as a practitioner"
      />
      <AuthCard>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            noValidate
          >
            {showCallout && (
              <div
                role="alert"
                className="flex gap-3 rounded-md border border-status-rejected-border/40 bg-status-rejected-bg px-4 py-3 text-sm text-status-rejected"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden
                />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Check your details</p>
                  <p>
                    {state.error ?? "Please correct the highlighted fields."}
                  </p>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your full name"
                      autoComplete="name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specialtyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Field / specialty</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your field" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {specialties.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Redesigned 2026-07-04 (Figma 294:13161): type is a radio pair
                ABOVE the number, and the chosen type renders as a prefix
                inside the number field. */}
            <FormField
              control={form.control}
              name="mmdcRegistrationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex items-center gap-6"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="PMR" />
                        </FormControl>
                        <FormLabel>PMR</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="TMR" />
                        </FormControl>
                        <FormLabel>TMR</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mmdcRegistration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration number</FormLabel>
                  {/* Wrapper stays OUTSIDE FormControl so the field id/aria
                      land on the Input, not the div. */}
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-primary"
                      aria-hidden
                    >
                      {form.watch("mmdcRegistrationType") ?? "PMR"}
                    </span>
                    <FormControl>
                      <Input
                        placeholder="Enter Number"
                        className="pl-14"
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

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+960 …"
                      autoComplete="tel"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating account…" : "Create account"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Already registered?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </Form>
      </AuthCard>
    </div>
  );
}
