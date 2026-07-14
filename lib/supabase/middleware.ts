// Session refresh + route protection + Content-Security-Policy for middleware.
// Runs on every matched request: builds a per-request CSP nonce, refreshes the
// Supabase auth cookie, and redirects unauthenticated users to /login.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/auth"];

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
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with Supabase — do not trust
  // getSession() alone for auth decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
