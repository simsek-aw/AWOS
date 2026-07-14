# AWOS — Sicherheitskonzept

Sicherheit ist bei AWOS kein Zusatz, sondern die Architektur selbst. Dieses Dokument
hält die Prinzipien fest, an denen sich jede Änderung messen lassen muss.

## Vertrauensgrenze

Die zentrale Grenze verläuft zwischen **Kundenwelt** und **interner Welt**. Ein Kunde
darf niemals
1. ein fremdes Kunden-Board sehen, noch
2. den internen Task/Kommentar zu seinem eigenen Task sehen.

Alle folgenden Maßnahmen dienen dieser einen Grenze.

## Prioritäten

| Priorität   | Thema                                             | Umgesetzt durch                        |
| ----------- | ------------------------------------------------- | -------------------------------------- |
| 🔴 Kritisch | Mandantentrennung serverseitig erzwingen          | Postgres Row-Level-Security (RLS)      |
| 🔴 Kritisch | Interne ↔ Kunden-Daten strukturell trennen        | Getrennte Objekte + `task_links`       |
| 🟠 Hoch     | Agent eng halten & Prompt Injection abwehren      | Enges Tool-Set, Input = Daten          |
| 🟠 Hoch     | Mitarbeiter-Accounts schützen                     | MFA, erprobter Auth-Provider           |
| 🟡 Mittel   | XSS / IDOR / Header / Audit-Log / DSGVO           | Sanitizing, RLS, CSP, `audit_log`      |

## 1. Row-Level-Security (RLS)

Isolation lebt in der Datenbank, nicht im App-Code. Selbst bei einem Bug im Backend
bekommt ein Kunde keine fremden Zeilen.

- **Jede** Tabelle mit Kundendaten hat RLS aktiviert und `FORCE`d.
- Kunden-Policies filtern immer über die Board-Zugehörigkeit → `customer_id`.
- Zugriff wird nie nur im Frontend „versteckt" — die API selbst gibt fremde Daten nicht her.

Siehe `supabase/migrations/0002_rls_policies.sql`.

## 2. Der `service_role`-Key

- Umgeht RLS vollständig. Ausschließlich serverseitig verwenden.
- Niemals an den Browser ausliefern, niemals in `NEXT_PUBLIC_*`-Variablen.
- Nur der Agent-Backend-Code und Admin-Jobs nutzen ihn.

## 3. Der Agent als privilegierter Akteur

Der Spiegelungs-Agent überschreitet absichtlich die Vertrauensgrenze. Deshalb:

- **Enges Tool-Set** statt freiem DB-Zugriff.
- **Prompt Injection**: Der Agent liest vom Kunden verfassten Text. Dieser Text ist
  immer *Daten*, nie *Anweisung*. Klar getrennte Prompt-Struktur (System-Instruktion vs.
  eingebetteter Nutzer-Content), keine Ausführung von im Content enthaltenen „Befehlen".
- **Rückkanal intern → Kunde**: sensibelster Schritt. Anfangs mit menschlicher Freigabe;
  nur explizit freigegebene Felder gehen an den Kunden.

## 4. Authentifizierung

- Erprobter Provider (Supabase Auth), kein Eigenbau des Passwort-Handlings.
- **MFA für Mitarbeiter** — ihr Account öffnet *alle* Kundendaten.
- Sichere Cookies (HttpOnly, Secure, SameSite), Rate-Limiting am Login.

## 5. Klassische Angriffsflächen

- **XSS**: Kommentare & Nutzer-Text werden beim Rendern escaped/sanitized.
- **IDOR**: IDs raten (`/task/124`) darf nie fremde Daten liefern → durch RLS abgedeckt.
- **Links/Uploads**: OneDrive-/Datei-Links validieren (kein `javascript:` o. Ä.).
- **Header**: CSP, HSTS; HTTPS erzwungen; Dependencies aktuell halten.

## 6. DSGVO / Datenschutz

- **Audit-Log**: wer hat wann was gesehen/geändert (`audit_log`).
- Verschlüsselung at-rest (DB) und in-transit (TLS).
- AVV mit Kunden, Löschkonzept, Datensparsamkeit.
- Secrets nur über Umgebungsvariablen / Secret-Manager, nie im Code.

## Checkliste für jede neue Tabelle / Route

- [ ] Enthält die Tabelle Kundendaten? → RLS aktivieren **und** Policies schreiben.
- [ ] Filtert die Policy zuverlässig auf `customer_id` bzw. Board-Zugehörigkeit?
- [ ] Nutzt Client-Code nur den `anon`-Key (nie `service_role`)?
- [ ] Wird nutzergenerierter Text beim Rendern escaped?
- [ ] Sicherheitsrelevante Aktion → Eintrag ins `audit_log`?
