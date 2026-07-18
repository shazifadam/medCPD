import { Resend } from "resend";

/**
 * Transactional email via Resend — approval notifications, certificate
 * delivery, registration confirmations. Server-only.
 */

declare global {
  // eslint-disable-next-line no-var
  var __resend: Resend | undefined;
}

export const resend =
  globalThis.__resend ?? new Resend(process.env.RESEND_API_KEY);
if (process.env.NODE_ENV !== "production") globalThis.__resend = resend;

export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Gradus CPD <noreply@cpd.mma.org.mv>";
