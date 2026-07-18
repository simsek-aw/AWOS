import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// OAuth (SSO) landing point. The provider redirects here with a `code` which we
// exchange for a session (PKCE). We then require an existing AWOS profile:
// AWOS stays invite-only, so a valid Microsoft login without a provisioned
// profile is rejected (and signed back out) instead of creating a ghost user.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Provider-reported error (e.g. user cancelled / consent denied).
  const providerError =
    searchParams.get("error_description") || searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(providerError)}`, origin),
    );
  }

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Must have a provisioned profile to enter (invite-only).
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle<{ id: string }>();
        if (profile) {
          return NextResponse.redirect(new URL(next, origin));
        }
      }
      // Authenticated at the IdP but not an AWOS user → sign back out, deny.
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(
            "Kein AWOS-Zugang für diese Adresse. Bitte wende dich an einen Administrator.",
          )}`,
          origin,
        ),
      );
    }
  }

  return NextResponse.redirect(
    new URL(
      `/login?error=${encodeURIComponent("Anmeldung fehlgeschlagen. Bitte erneut versuchen.")}`,
      origin,
    ),
  );
}
