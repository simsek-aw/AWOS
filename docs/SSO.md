# AWOS Single Sign-On (ein Login für alle AW-Tools)

Ziel: Ein Nutzer meldet sich einmal an und hat Zugang zu allen Tools (AWcms,
AWideogram, AWmeet, AWcreative, …) — ohne erneuten Login.

## Ansatz: gemeinsames Supabase-Projekt + geteilte Cookie-Domain

Alle AW-Tools nutzen **dasselbe Supabase-Projekt** für Auth. Die Session lebt in
einem Cookie; wenn dieser auf die **gemeinsame Parent-Domain** gesetzt wird,
gilt er für alle Subdomains → eine Session über alle Tools.

### 1. Domains (Empfehlung)

Jedes Tool auf einer Subdomain **derselben** Domain:

| Tool | Domain |
|------|--------|
| AWOS (Plattform/CMS) | `awos.absolutweb.de` |
| AWideogram | Teil von AWOS (`/tools/awideogram`) |
| AWmeet | `awmeet.absolutweb.de` |
| AWcreative | `awcreative.absolutweb.de` |

### 2. Env-Var in **jedem** Tool setzen

```
AUTH_COOKIE_DOMAIN=.absolutweb.de
```

- Führender Punkt = gilt für alle Subdomains.
- **Nur in Produktion** setzen. Für localhost / Vercel-Preview weglassen
  (die liegen nicht auf dieser Domain — sonst wird der Cookie nicht gesetzt).
- In AWOS ist die Auswertung bereits eingebaut (`lib/supabase/cookie.ts`):
  ist die Var gesetzt, bekommt der Supabase-Auth-Cookie diese `domain`.

### 3. Dasselbe Supabase-Projekt in allen Tools

Jedes Tool verwendet dieselben Werte:

```
NEXT_PUBLIC_SUPABASE_URL=...        # identisch in allen Tools
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # identisch in allen Tools
```

Damit teilen sich die Tools Nutzer, Session und (falls gewünscht) die
`profiles`-Tabelle inkl. Rollen.

### 4. Session in einem anderen Tool lesen

Ein Tool auf Basis von `@supabase/ssr` (wie AWOS) liest die Session automatisch
aus dem geteilten Cookie:

```ts
import { createServerClient } from "@supabase/ssr";
// ... mit denselben SUPABASE_URL/ANON_KEY und der Cookie-Bridge wie in AWOS
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("https://awos.absolutweb.de/login");
```

Nicht-Next-Tools: das Supabase Access-Token (JWT) aus dem Cookie lesen und mit
dem eigenen Supabase-Client / JWKS des Projekts verifizieren.

### 5. Zentraler Login + Logout

- **Login** immer über AWOS (`/login`). Andere Tools leiten nicht-eingeloggte
  Nutzer dorthin (mit `?next=<zurück-URL>`).
- **Logout** über AWOS (`/auth/signout`); da der Cookie auf `.absolutweb.de`
  liegt, endet die Session überall.

## Sonderfall: Tool kann NICHT auf dasselbe Supabase

Dann Handoff per kurzlebigem, signiertem Token:
1. AWOS-Endpoint `GET /api/sso/token` gibt ein signiertes JWT (60 s) mit
   User-ID/Rolle aus.
2. Das Zieltool ruft beim Öffnen dieses Token ab und prüft es gegen
   `GET /api/sso/verify` (oder per gemeinsamem Secret / JWKS) und legt seine
   eigene Session an.

Diesen Weg bauen wir nur, wenn ein Tool nicht auf Supabase migriert werden kann.

## Checkliste zum Aktivieren

- [ ] AWmeet/AWcreative auf **dasselbe Supabase-Projekt** zeigen lassen.
- [ ] Alle Tools auf Subdomains **einer** Domain deployen.
- [ ] In allen Tools `AUTH_COOKIE_DOMAIN=.<domain>` setzen (nur Prod).
- [ ] Login/Logout zentral über AWOS.
- [ ] Testen: in AWOS einloggen → AWmeet öffnen → ohne erneuten Login drin.

---

# Login per Microsoft 365 / Entra ID (SSO für Mitarbeiter)

Mitarbeiter melden sich mit ihrem Microsoft-Firmenkonto an ("Mit Microsoft
anmelden"). E-Mail/Passwort bleibt als Fallback (z. B. für Kunden-Accounts).

**Was schon eingebaut ist (Code):**
- Button „Mit Microsoft anmelden" auf `/login` (`components/AuthBox.tsx`),
  startet den Azure-OAuth-Flow.
- OAuth-Callback `app/auth/callback/route.ts`: tauscht den Code gegen eine
  Session **und verlangt ein vorhandenes AWOS-Profil**. AWOS bleibt
  invite-only: Wer sich bei Microsoft gültig anmeldet, aber kein AWOS-Profil
  hat, wird wieder abgemeldet und abgewiesen.

**Was du einmalig einrichten musst** (Azure-Portal + Supabase-Dashboard):

### 1. App-Registrierung in Microsoft Entra (Azure)
1. Entra Admin Center → **App registrations** → **New registration**.
2. Name z. B. `AWOS`. **Supported account types**:
   *Accounts in this organizational directory only* (nur euer Tenant →
   Fremd-Microsoft-Konten sind so schon ausgeschlossen).
3. **Redirect URI** (Web) =
   `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
   (die Supabase-Callback-URL, steht im Supabase-Dashboard beim Azure-Provider).
4. Nach dem Anlegen: **Application (client) ID** und **Directory (tenant) ID**
   notieren.
5. **Certificates & secrets** → **New client secret** → Wert kopieren
   (nur einmal sichtbar).
6. **API permissions** → Microsoft Graph → *Delegated* → `openid`, `email`,
   `profile` (meist schon vorhanden) → ggf. **Grant admin consent**.

### 2. Provider in Supabase aktivieren
Supabase-Dashboard → **Authentication → Providers → Azure**:
- **Enable** an.
- **Client ID** = Application (client) ID.
- **Secret** = der Client-Secret-Wert.
- **Azure Tenant URL** = `https://login.microsoftonline.com/<TENANT-ID>`
  (single-tenant; damit ist der Login auf euren Tenant beschränkt).
- Speichern.

### 3. Redirect-URLs in Supabase freigeben
Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://awos.absolutweb.de`
- **Redirect URLs** (Allow-List) ergänzen:
  - `https://awos.absolutweb.de/auth/callback`
  - für lokale Tests zusätzlich `http://localhost:3000/auth/callback`

### 4. Mitarbeiter anlegen
- Mitarbeiter **wie bisher im Admin einladen** (Profil wird angelegt). Die
  **E-Mail muss der Microsoft-Anmeldeadresse entsprechen** (@absolutweb.de).
- Beim ersten „Mit Microsoft anmelden" verknüpft Supabase die Microsoft-
  Identität automatisch mit dem bestehenden Konto (gleiche, bestätigte E-Mail)
  → dasselbe Profil, dieselbe Rolle. Ein Passwort ist dann nicht mehr nötig.

### Hinweise
- **Zugriffssteuerung** = AWOS-Profil. Nur wer eingeladen wurde, kommt rein;
  ein gültiger Microsoft-Login allein genügt nicht.
- Kein Auto-Provisioning: neue Mitarbeiter zuerst im Admin einladen.
- Kunden/externe Accounts nutzen weiterhin E-Mail/Passwort.
