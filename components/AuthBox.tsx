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

  return (
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
              brand: "#0073ea",
              brandAccent: "#0060c9",
              brandButtonText: "#ffffff",
              inputBackground: "#12151f",
              inputBorder: "#2c3142",
              inputBorderHover: "#3a4258",
              inputText: "#e8eaf0",
              inputLabelText: "#9aa1b8",
              inputPlaceholder: "#6b7189",
              messageText: "#e8eaf0",
              anchorTextColor: "#0073ea",
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
  );
}
