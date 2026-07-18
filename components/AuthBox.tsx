"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Supabase's prebuilt Auth UI, wired to our cookie-based (@supabase/ssr) browser
// client so the session is written to cookies the server can read. Invite-only:
// sign-in view, no self sign-up links.
export default function AuthBox() {
  const [supabase] = useState(() => createClient());
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // On a fresh sign-in, do a full navigation so the server picks up the
      // freshly-written auth cookies.
      if (event === "SIGNED_IN") window.location.assign("/");
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const signInWithMicrosoft = async () => {
    setSsoError(null);
    setSsoLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid email profile",
      },
    });
    // On success the browser redirects to Microsoft; only errors return here.
    if (error) {
      setSsoError("Microsoft-Anmeldung nicht möglich. Bitte erneut versuchen.");
      setSsoLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={signInWithMicrosoft}
        disabled={ssoLoading}
        style={{
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
          fontSize: 14,
          fontWeight: 600,
          cursor: ssoLoading ? "default" : "pointer",
          opacity: ssoLoading ? 0.7 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
          <rect x="1" y="1" width="10" height="10" fill="#f25022" />
          <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
          <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
          <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
        </svg>
        {ssoLoading ? "Weiterleitung…" : "Mit Microsoft anmelden"}
      </button>

      {ssoError && (
        <p style={{ color: "var(--danger)", fontSize: 13, margin: "10px 0 0" }}>
          {ssoError}
        </p>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "18px 0 6px",
          color: "var(--faint)",
          fontSize: 12,
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        oder
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <Auth
      supabaseClient={supabase}
      view="sign_in"
      showLinks={false}
      providers={[]}
      appearance={{
        theme: ThemeSupa,
        variables: {
          default: {
            colors: {
              brand: "#f2691c",
              brandAccent: "#d9530a",
              brandButtonText: "#ffffff",
              inputBackground: "#12151f",
              inputBorder: "#2c3142",
              inputBorderHover: "#3a4258",
              inputText: "#e8eaf0",
              inputLabelText: "#9aa1b8",
              inputPlaceholder: "#6b7189",
              messageText: "#e8eaf0",
              anchorTextColor: "#f2691c",
              dividerBackground: "#2c3142",
            },
            radii: {
              borderRadiusButton: "8px",
              inputBorderRadius: "8px",
            },
          },
        },
      }}
      localization={{
        variables: {
          sign_in: {
            email_label: "E-Mail",
            password_label: "Passwort",
            email_input_placeholder: "deine@email.de",
            password_input_placeholder: "Passwort",
            button_label: "Anmelden",
            loading_button_label: "Anmelden…",
          },
        },
      }}
    />
    </>
  );
}
