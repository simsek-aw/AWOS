// Session refresh + route protection + Content-Security-Policy for middleware.
// Runs on every matched request: builds a per-request CSP nonce, refreshes the
// Supabase auth cookie, and redirects unauthenticated users to /login.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withCookieDomain } from "./cookie";

// /api/cron is protected by its own CRON_SECRET check, not the session.
const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/api/cron",
  "/api/client-error", // error reporting must work even when logged out
];

// Build the CSP. In production, scripts are locked to a per-request nonce +
// strict-dynamic (no inline/eval). In development we relax script-src so
// Next.js HMR (which uses eval + inline scripts) keeps working.
function buildCsp(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let supabaseHost = "";
  try {
    supabaseHost = new URL(supabaseUrl).host;
  } catch {
    /* unset/invalid in some environments — connect-src just omits it */
  }
  const dev = process.env.NODE_ENV !== "production";

  const scriptSrc = dev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const connectSrc = ["'self'", supabaseUrl, supabaseHost && `wss://${supabaseHost}`]
    .filter(Boolean)
    .join(" ");
  const imgSrc = ["'self'", "data:", "blob:", supabaseUrl].filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // React renders inline style attributes (style={{…}}); those need
    // 'unsafe-inline' (nonces don't cover style attributes). Not a script
    // execution vector.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail with a readable message instead of an opaque MIDDLEWARE_INVOCATION_FAILED
  // when the app was built/deployed without the Supabase env vars. Still blocks
  // (does not fall through to unauthenticated access).
  if (!supabaseUrl || !supabaseAnonKey) {
    return new NextResponse(
      "Serverkonfiguration unvollständig: NEXT_PUBLIC_SUPABASE_URL und " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY fehlen. In Vercel unter Settings → " +
        "Environment Variables (Environment: Production) setzen und danach neu " +
        "deployen (Redeploy).",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  // The URL must be a valid https(s) URL — a stray space, missing scheme, or
  // trailing newline would otherwise make the Supabase fetch throw and crash
  // the whole middleware (opaque MIDDLEWARE_INVOCATION_FAILED).
  let urlOk = false;
  try {
    const u = new URL(supabaseUrl);
    urlOk = u.protocol === "https:" || u.protocol === "http:";
  } catch {
    urlOk = false;
  }
  if (!urlOk) {
    return new NextResponse(
      "NEXT_PUBLIC_SUPABASE_URL ist keine gültige URL. Erwartet wird z. B. " +
        "https://<projekt>.supabase.co (mit https://, ohne Leerzeichen/Zeilenumbruch, " +
        "ohne Schrägstrich am Ende). In Vercel korrigieren und neu deployen.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Pass the nonce + CSP on the REQUEST headers so Next.js applies the nonce to
  // its own scripts and components can read `x-nonce` for any inline script.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, withCookieDomain(options)),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with Supabase — do not trust
  // getSession() alone for auth decisions. Wrapped so a transient Supabase
  // error can't crash the middleware; on failure we treat the user as
  // unauthenticated (fail closed → protected routes redirect to /login).
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (e) {
    console.error("middleware getUser failed:", e);
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  response.headers.set("content-security-policy", csp);
  return response;
}
