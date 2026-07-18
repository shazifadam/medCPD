import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * PKCE code-exchange bridge — the free-tier email path.
 *
 * Supabase's DEFAULT email templates route through its hosted verify URL,
 * which redirects here with `?code=`. Exchanging it (against the PKCE
 * verifier cookie set when the OTP was issued) establishes the session,
 * then we forward to `next` (/set-password for signup + reset).
 *
 * /auth/confirm (token_hash) stays for when custom SMTP + templates land.
 * Caveat of this flow: the link must be opened in the SAME browser that
 * initiated signup/reset (the verifier cookie lives there).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/set-password";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=link_expired", request.url)
  );
}
