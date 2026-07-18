import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session refresh + coarse auth gating (Edge runtime).
 *
 * Responsibilities:
 *  1. Refresh the Supabase auth session on every request (writes rotated
 *     cookies back onto the response) — required because Server Components
 *     can't set cookies (see lib/auth/supabase.ts).
 *  2. Bounce signed-out users away from protected areas to /login.
 *  3. Bounce signed-in users away from the auth pages to their portal.
 *
 * It deliberately does NOT check registration approval or role — those read
 * our own tables via postgres-js, which needs the Node runtime. The
 * (portal) layout owns the approval + role gate.
 */

// Auth-flow pages: reachable only while signed OUT. (/pending and
// /set-password need a session — they are NOT in this list: /set-password
// is where email links land, /pending is the unapproved gate.)
const AUTH_PATHS = ["/login", "/signup", "/forgot-password"];

// Fully public pages: reachable in any auth state. /auth covers the email
// link bridges (/auth/callback, /auth/confirm) — they run BEFORE a session
// exists; gating them strands the ?code= exchange at /login.
const PUBLIC_PREFIXES = ["/privacy", "/terms", "/verify", "/pending", "/auth"];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and getUser() — auth tokens
  // must refresh in one pass (Supabase SSR guidance).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Signed out, hitting a protected route → send to login.
  if (!user && !isAuthPath(pathname) && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Signed in, hitting an auth page → send to portal root (layout re-routes
  // by approval/role from there).
  if (user && isAuthPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
