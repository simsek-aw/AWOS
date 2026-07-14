# AWOS — Deployment (Vercel + Subdomain)

Ziel: AWOS auf Vercel betreiben, später unter `awos.absolutweb.de`.
Am Code ist nichts zu ändern — alles hier ist Konfiguration.

## 1. Projekt bei Vercel importieren

1. Auf [vercel.com](https://vercel.com) mit dem GitHub-Account anmelden.
2. **Add New → Project** → das AWOS-Repository auswählen.
3. Framework wird als **Next.js** erkannt — Build-Einstellungen unverändert lassen.
4. **Noch nicht deployen** — zuerst die Umgebungsvariablen setzen (Schritt 2).

## 2. Umgebungsvariablen (Vercel → Project → Settings → Environment Variables)

Dieselben Werte wie in der lokalen `.env.local`:

| Variable | Wert |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<projekt>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key — **Secret**, niemals ins Repo |
| `NEXT_PUBLIC_SITE_URL` | zuerst die Vercel-URL, später `https://awos.absolutweb.de` |
| `ANTHROPIC_API_KEY` | nur falls der Spiegelungs-Agent laufen soll |

Danach **Deploy**. Du bekommst eine URL wie `awos-xyz.vercel.app` zum Testen.

## 3. Erst auf der vercel.app-URL testen

Damit Login/Einladungen auf der vorläufigen URL funktionieren, in Supabase
(**Authentication → URL Configuration**):
- **Site URL**: die aktuelle `*.vercel.app`-Adresse
- **Redirect URLs**: `https://<deine>.vercel.app/**`

Wenn alles läuft, weiter zur eigenen Subdomain.

## 4. Subdomain `awos.absolutweb.de` verbinden

1. Vercel → Project → **Settings → Domains** → `awos.absolutweb.de` hinzufügen.
2. Vercel zeigt einen DNS-Eintrag an — für eine Subdomain ein **CNAME**:
   - **Name/Host**: `awos`
   - **Ziel/Value**: der von Vercel angezeigte Wert (i. d. R. `cname.vercel-dns.com`)
3. Diesen CNAME beim DNS-Anbieter von `absolutweb.de` anlegen (dort, wo die
   Domain verwaltet wird).
4. Vercel erkennt den Eintrag automatisch und stellt das SSL-Zertifikat aus
   (kann einige Minuten dauern).

## 5. Nach dem Domain-Wechsel angleichen

- **Vercel**: `NEXT_PUBLIC_SITE_URL` = `https://awos.absolutweb.de` → neu deployen
  (Redeploy, damit die Variable greift).
- **Supabase → Authentication → URL Configuration**:
  - **Site URL**: `https://awos.absolutweb.de`
  - **Redirect URLs**: `https://awos.absolutweb.de/**` (die alte vercel.app-Zeile
    kann bleiben oder raus)

## 6. E-Mail-Versand (für echte Einladungen)

Der eingebaute Supabase-Mailversand ist nur zum Testen (Limit + liefert nur an
Projektmitglieder). Für echte Kundeneinladungen unter **Authentication → Emails →
SMTP Settings** einen eigenen Anbieter hinterlegen (z. B. Resend, Postmark,
SendGrid). Absender am besten eine Adresse auf `absolutweb.de`.

Und das Invite-Template auf den token_hash-Link umstellen (siehe Einladungsflow):

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/update-password
```

## Hinweise

- **Region/Latenz**: In den Vercel-Projekteinstellungen die Function-Region nah
  an der Supabase-Region wählen (z. B. Frankfurt `fra1`, wenn Supabase in der
  EU liegt) — spart Roundtrip-Zeit.
- **Secrets**: `SUPABASE_SERVICE_ROLE_KEY` und `ANTHROPIC_API_KEY` nur als
  Vercel-Environment-Variablen, nie committen. `.env.local` ist gitignored.
- **Migrationen**: Vor dem ersten echten Einsatz sicherstellen, dass alle
  SQL-Migrationen aus `supabase/migrations/` in der Supabase-DB angewendet sind.
