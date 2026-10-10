"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, XCircle } from "lucide-react";
import { reapplySchema, type ReapplyInput } from "@/lib/schemas";
import { reapplyAction, type ReapplyState } from "@/app/(auth)/reapply/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/patterns/phone-input";
import { DEFAULT_DIAL_CODE, splitPhone } from "@/lib/phone";
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

export interface ReapplyFormProps {
  fullName: string;
  email: string;
  phone: string | null;
  mmdcRegistration: string | null;
  mmdcRegistrationType: "PMR" | "TMR" | null;
  rejectionReason: string | null;
}

/**
 * /reapply. No designed frame (deliberate deviation): a clone of the AU3
 * sign-up anatomy (Figma 294:13161), prefilled from the rejected profile,
 * with the email locked and the previous decision shown on top.
 */
export function ReapplyForm(props: ReapplyFormProps) {
  const router = useRouter();
  const [state, setState] = useState<ReapplyState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();
  const phone = splitPhone(props.phone);

  const form = useForm<ReapplyInput>({
    resolver: zodResolver(reapplySchema),
    defaultValues: {
      fullName: props.fullName,
      mmdcRegistration: props.mmdcRegistration ?? "",
      mmdcRegistrationType: props.mmdcRegistrationType ?? undefined,
      phoneDialCode: phone.dial || DEFAULT_DIAL_CODE,
      phone: phone.national,
    },
  });

  function onSubmit(values: ReapplyInput) {
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => fd.set(k, v ?? ""));
      const next = await reapplyAction({ status: "idle", error: null }, fd);
      setState(next);
      if (next.status === "success") {
        router.push("/pending");
        router.refresh();
      }
    });
  }

  // Same AU4 callout rule as sign-up: server error or failed validation,
  // hidden while the request is in flight.
  const showCallout =
    !pending &&
    (state.status === "error" ||
      (form.formState.submitCount > 0 &&
        Object.keys(form.formState.errors).length > 0));

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <AuthHeading
        title="Update your application"
        subtitle="Correct your details and resubmit for MMA review"
      />
      <AuthCard>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            noValidate
          >
            {props.rejectionReason && (
              <div
                role="note"
                className="flex gap-3 rounded-md bg-status-rejected-bg px-4 py-3 text-sm text-status-rejected"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>Previous decision: {props.rejectionReason}</p>
              </div>
            )}

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

            {form.watch("mmdcRegistrationType") && (
              <FormField
                control={form.control}
                name="mmdcRegistration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration number</FormLabel>
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
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="reapply-email">Email</Label>
              <Input
                id="reapply-email"
                type="email"
                value={props.email}
                disabled
                readOnly
                aria-describedby="reapply-email-help"
              />
              <p
                id="reapply-email-help"
                className="text-sm text-muted-foreground"
              >
                Email can&apos;t be changed here.
              </p>
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact number</FormLabel>
                  <FormControl>
                    <PhoneInput
                      placeholder="7771234"
                      dialCode={form.watch("phoneDialCode") ?? DEFAULT_DIAL_CODE}
                      onDialCodeChange={(dial) =>
                        form.setValue("phoneDialCode", dial, {
                          shouldValidate: form.formState.isSubmitted,
                        })
                      }
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  {form.formState.errors.phoneDialCode && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.phoneDialCode.message}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Resubmitting…
                </>
              ) : (
                "Resubmit application"
              )}
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link href="/pending">Back</Link>
            </Button>
          </form>
        </Form>
      </AuthCard>
    </div>
  );
}
