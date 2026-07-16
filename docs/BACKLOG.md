# AWOS – Backlog / für später gemerkt

Offene Punkte, die bewusst aufgeschoben wurden.

## Setup / Betrieb
- **Anthropic API-Key** in Vercel setzen (`ANTHROPIC_API_KEY`, Sensitive, ohne
  `NEXT_PUBLIC_`), danach Redeploy. Schaltet Assistent, Creative-Agent,
  Spiegel-Briefing, Triage und Auto-Reply scharf.
- Optional ebenso: `RESEND_API_KEY` + `EMAIL_FROM` (verifizierter Absender),
  `CRON_SECRET`.
- **Supabase Pro** sobald produktiv: kein Auto-Pausieren + tägliche Backups
  (7 Tage). Board-Anzahl ist unkritisch; es geht um Betrieb/Backups.
- **Connection Pooling** (Supavisor „Transaction Pooler") für Vercel-Serverless,
  wenn gleichzeitige Last steigt.
- **Index-Migration** für heiße Abfragen (task_values, comments) bei mehr Daten.

## monday-Import
- Parser/Auto-Mapping an echtem Export feinjustieren (Gruppen-Trennzeilen,
  Sub-Items, Mehrfach-Personenspalten, Status-Label-Abgleich).
- Häppchenweise pro Board importieren; Beispielzeilen liefern.

## Features (aufgeschoben)
- Timeline/Gantt (braucht Startdatum-Spalte).
- Subtasks / Checklisten.
- Datei-Vorschau & Drag-&-Drop-Upload.
- Wiederkehrende Aufgaben.
- Benachrichtigungs-Einstellungen pro Nutzer (welche Typen als Mail/in-App).
