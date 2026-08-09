import { resend, EMAIL_FROM } from "@/lib/email";

/**
 * Branded transactional emails. Shares the exact layout of the Supabase
 * auth templates in supabase/templates/ (design source: Figma "Shipping"
 * section). Tokens inlined for email clients: wrapper #F0F0F0, card
 * #FCFCFC, border #D9D9D9, text #1F1F1F/#595959, primary #065BA1.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

type BrandedEmail = {
  heading: string;
  /** Already-escaped HTML paragraphs (use esc() for interpolated values). */
  paragraphs: string[];
  button?: { label: string; url: string };
  note?: string;
};

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderBrandedEmail(e: BrandedEmail): string {
  const paragraphs = e.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#595959;">${p}</p>`
    )
    .join("\n                ");
  const button = e.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                  <tr>
                    <td style="background-color:#065BA1;border-radius:6px;">
                      <a href="${e.button.url}" style="display:inline-block;padding:12px 24px;font-size:15px;line-height:20px;font-weight:500;color:#FFFFFF;text-decoration:none;">${esc(e.button.label)}</a>
                    </td>
                  </tr>
                </table>`
    : "";
  const note = e.note
    ? `<hr style="border:none;border-top:1px solid #D9D9D9;margin:0 0 20px;" />
                <p style="margin:0;font-size:13px;line-height:20px;color:#595959;">${e.note}</p>`
    : "";
  return `<html>
  <body style="margin:0;padding:0;background-color:#F0F0F0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0F0F0;">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <img src="${APP_URL}/email-logo.png" width="234" height="28" alt="Gradus CPD System" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="background-color:#FCFCFC;border:1px solid #D9D9D9;border-radius:8px;padding:40px;font-family:${FONT};">
                <h1 style="margin:0 0 20px;font-size:24px;line-height:32px;font-weight:600;color:#1F1F1F;">${esc(e.heading)}</h1>
                ${paragraphs}
                ${button}
                ${note}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:24px;font-family:${FONT};">
                <p style="margin:0 0 4px;font-size:12px;line-height:18px;color:#595959;">Gradus CPD &middot; Maldives Medical Association</p>
                <p style="margin:0;font-size:12px;line-height:18px;color:#595959;">Automated message from cpd.medicalmv.com &mdash; please don't reply.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Fire-and-forget send: notification emails must never fail the action
 * that triggered them. E2e fixture addresses are skipped entirely.
 */
export async function sendBrandedEmail(
  to: string,
  subject: string,
  email: BrandedEmail
): Promise<void> {
  if (to.endsWith("@cpd-test.local")) return;
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html: renderBrandedEmail(email),
    });
  } catch (err) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, err);
  }
}

export function registrationApprovedEmail(fullName: string): BrandedEmail {
  return {
    heading: "Your registration is approved",
    paragraphs: [
      `Dear ${esc(fullName)},`,
      "The MMA secretariat has verified your registration. Your Gradus account is now active — sign in to start logging CPD activities, browse accredited events, and track your cycle progress.",
    ],
    button: { label: "Sign in to Gradus", url: `${APP_URL}/login` },
    note: "If you have any questions about your registration, contact the MMA secretariat.",
  };
}

export function registrationRejectedEmail(
  fullName: string,
  reason: string
): BrandedEmail {
  return {
    heading: "Update on your registration",
    paragraphs: [
      `Dear ${esc(fullName)},`,
      "The MMA secretariat was unable to approve your Gradus registration.",
      `<strong style="color:#1F1F1F;">Reason:</strong> ${esc(reason)}`,
    ],
    note: "If you believe this is a mistake or want to provide additional information, contact the MMA secretariat.",
  };
}

export function entryApprovedEmail(
  fullName: string,
  entryTitle: string,
  credits: string,
  adjusted: boolean
): BrandedEmail {
  return {
    heading: "Your CPD entry was approved",
    paragraphs: [
      `Dear ${esc(fullName)},`,
      adjusted
        ? `The CPD Committee has reviewed <strong style="color:#1F1F1F;">${esc(entryTitle)}</strong> and approved it with adjusted credits: <strong style="color:#1F1F1F;">${esc(credits)} credits</strong> have been added to your record.`
        : `The CPD Committee has approved <strong style="color:#1F1F1F;">${esc(entryTitle)}</strong>. <strong style="color:#1F1F1F;">${esc(credits)} credits</strong> have been added to your record.`,
    ],
    button: { label: "View My CPD", url: `${APP_URL}/my-cpd` },
  };
}

export function entryRejectedEmail(
  fullName: string,
  entryTitle: string,
  reason: string
): BrandedEmail {
  return {
    heading: "Your CPD entry was not approved",
    paragraphs: [
      `Dear ${esc(fullName)},`,
      `The CPD Committee has reviewed <strong style="color:#1F1F1F;">${esc(entryTitle)}</strong> and was unable to approve it.`,
      `<strong style="color:#1F1F1F;">Reason:</strong> ${esc(reason)}`,
    ],
    button: { label: "View My CPD", url: `${APP_URL}/my-cpd` },
    note: "You can log a corrected entry with supporting evidence at any time.",
  };
}
