import type { EmailLinkType } from "./types";

/**
 * Helpers for the emailed one-time links (/auth/confirm?token_hash&type&next).
 * Pure functions so both the interstitial page and its action share one
 * reading of the query string.
 */

const LINK_TYPES: readonly EmailLinkType[] = ["signup", "recovery", "magiclink"];

export function parseLinkType(value: unknown): EmailLinkType | null {
  return typeof value === "string" &&
    (LINK_TYPES as readonly string[]).includes(value)
    ? (value as EmailLinkType)
    : null;
}

/**
 * Where to land after the link is redeemed. Only same-origin paths are
 * honoured (no open redirect); everything else falls back to AU8, which is
 * where every emailed link should end up — the user still has no password.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/set-password";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/set-password";
  }
  return value;
}

/** Copy for the interstitial, per link kind (AU6-style card). */
export function linkCopy(type: EmailLinkType): {
  title: string;
  body: string;
  button: string;
  pendingLabel: string;
} {
  switch (type) {
    case "signup":
      return {
        title: "Verify your email address",
        body: "Confirm it's you to activate your Gradus account and choose a password.",
        button: "Verify email address",
        pendingLabel: "Verifying…",
      };
    case "recovery":
      return {
        title: "Reset your password",
        body: "Confirm it's you to continue and choose a new password.",
        button: "Continue",
        pendingLabel: "Checking link…",
      };
    case "magiclink":
      return {
        title: "Sign in to Gradus",
        body: "Confirm it's you to continue to your account.",
        button: "Continue",
        pendingLabel: "Signing you in…",
      };
  }
}
