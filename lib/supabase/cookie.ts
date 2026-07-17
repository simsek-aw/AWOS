// Single sign-on across AW tools.
//
// When all AW tools run on the same Supabase project and share a parent domain
// (e.g. awos.absolutweb.de, awmeet.absolutweb.de), setting the auth cookie's
// `domain` to the shared parent (".absolutweb.de") makes one login valid across
// every tool — a true single session.
//
// Gated behind AUTH_COOKIE_DOMAIN so localhost and Vercel preview URLs (which
// aren't on that parent domain) keep working with host-scoped cookies.
export function withCookieDomain(
  options?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (!domain) return options;
  return { ...(options ?? {}), domain };
}
