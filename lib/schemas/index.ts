import { z } from "zod";

/**
 * Shared Zod schemas — the single source of truth for validation
 * (Stack decision: used by React Hook Form resolvers on the client AND
 * API route validation on the server; one schema, two enforcement points).
 *
 * Domain schemas (cycles, activities, entries, events, certificates)
 * are added here as their features are built. Shapes follow the
 * Database Schema doc in the project vault.
 */

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type SignInInput = z.infer<typeof signInSchema>;

/**
 * AU3 — Sign up. Passwordless by design (decision 2026-07-04): the account
 * is created via email link; the password is set afterwards on AU8. Fields
 * match the designed form exactly (no password field).
 */
export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name"),
    specialtyId: z.string().uuid("Select your field"),
    // Validated conditionally below: the field only appears once a
    // registration type is picked, so it must not fail while it is hidden.
    mmdcRegistration: z.string().trim().max(32, "Enter a valid PMR/TMR number"),
    mmdcRegistrationType: z.enum(["PMR", "TMR"], {
      error: "Select your registration type",
    }),
    email: z.string().email("Enter a valid email address"),
    /**
     * Contact number is split in two: the calling code comes from the in-field
     * selector (default +960 — user directive 2026-07-31), the national digits
     * from the input beside it. Stored joined, `formatPhone()` in lib/phone.
     */
    phoneDialCode: z
      .string()
      .trim()
      .regex(/^\+[0-9]{1,4}$/, "Select a country code"),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9]{6,15}$/, "Enter a valid contact number"),
    /** OrgCombobox value: `id:<uuid>` or `new:<name>` (Update 1 §5). */
    primaryWorkplace: z
      .string()
      .regex(/^(id:.+|new:.{2,})$/, "Select or add your primary workplace"),
  })
  .superRefine((values, ctx) => {
    // The number field is revealed by the type radio (user directive
    // 2026-07-31), so only demand it once a type has been chosen —
    // otherwise the form would fail on a field that isn't on screen.
    if (values.mmdcRegistrationType && values.mmdcRegistration.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["mmdcRegistration"],
        message: "Enter a valid PMR/TMR number",
      });
    }
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

/** AU8 — Set a new password (also serves AU7's reset flow). */
export const setPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

/**
 * LA2 — Log CPD activity (self-reported entry). Evidence file rides the
 * FormData outside zod (validated server-side: PDF/JPG/PNG ≤ 10 MB).
 */
export const logActivitySchema = z.object({
  title: z.string().trim().min(3, "Activity title is required"),
  activityTypeId: z.string().uuid("Activity type is required"),
  occurredOn: z
    .string({ error: "Date is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  hoursSessions: z
    .string()
    .trim()
    .min(1, "Hours / sessions is required")
    .refine(
      (v) => !Number.isNaN(Number(v)) && Number(v) > 0 && Number(v) <= 999,
      "Enter a value greater than 0"
    ),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type LogActivityInput = z.infer<typeof logActivitySchema>;

/** AU7 — Forgot password (request reset link). */
export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
