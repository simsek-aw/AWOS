# AWOS — Agency CMS

AWOS ist ein schlankes, personalisiertes Agentur-CMS – strukturell inspiriert von
monday.com, aber bewusst einfach gehalten und auf den Workflow einer Agentur
zugeschnitten.

## Grundidee

- **Boards für Kunden**: Jeder Kunde erhält Zugriff auf sein eigenes Board, kann dort
  Tasks erstellen, kommentieren und Stati anpassen — sieht aber **ausschließlich** sein
  eigenes Board.
- **Internes Board**: Für das Team, aufgeteilt in Abteilungen (Marketing, Content,
  Grafik). Mitarbeiter haben Zugriff auf **alle** Boards.
- **Individuell anpassbare Spalten**: Standardmäßig Task-ID, Name, PM, Macher, Status,
  Deadline und optional ein OneDrive-Link. Weitere Spalten sind pro Board frei
  definierbar.
- **Agent-gestützte Spiegelung**: Wird in einem Kunden-Board ein Task erstellt, prüft ein
  Agent, für wen intern der Task relevant ist, und spiegelt ihn ins interne Board. Dort
  wird bearbeitet und kommentiert, **ohne dass der Kunde etwas davon mitbekommt**. Beim
  Kunden landet nur das fertige Ergebnis mit einem kurzen Kommentar.

## Tech-Stack

| Bereich        | Wahl                              | Warum                                                        |
| -------------- | --------------------------------- | ------------------------------------------------------------ |
| Frontend       | Next.js (App Router, TypeScript)  | Ein Framework für UI + serverseitige Logik/Agent-Endpoints   |
| Datenbank/Auth | Supabase (Postgres + Auth)        | **Row-Level-Security** und Auth ab Werk — Kern unserer Isolation |
| Dateien        | Supabase Storage / OneDrive-Links | Anhänge & Verweise                                           |
| Agent          | Anthropic Claude (serverseitig)   | Relevanzprüfung & Spiegelung                                 |

## Die wichtigste Design-Entscheidung (Sicherheit)

Interne und kundenseitige Daten werden als **zwei getrennte, verknüpfte Datensätze**
gehalten — nicht als ein Datensatz mit „sichtbar-für-Kunde"-Flag. Dadurch ist der
schlimmste denkbare Datenabfluss (ein interner Kommentar taucht beim Kunden auf)
**strukturell unmöglich** statt nur „gut abgesichert".

Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) und
[`docs/SECURITY.md`](docs/SECURITY.md).

## Projektstruktur

```
awos/
├── app/                    # Next.js App Router (UI + Route Handlers)
├── lib/supabase/           # Supabase-Clients (Browser + Server)
├── supabase/migrations/    # DB-Schema, RLS-Policies, Seed-Daten (SQL)
└── docs/                   # Architektur- & Sicherheitsdokumentation
```

## Setup (lokal)

> Voraussetzung: Node 20+, ein Supabase-Projekt (Cloud oder lokal via Supabase CLI).

```bash
npm install
cp .env.example .env.local     # Werte eintragen
# Migrationen aus supabase/migrations/ auf die Datenbank anwenden
npm run dev
```

## Status

Lauffähiges MVP-Gerüst:

- ✅ Datenmodell + RLS-Sicherheitskern (verhaltensgeprüft: Kundenisolation, kein
  Leak interner Kommentare)
- ✅ Auth-Flow (Login/Logout, geschützte Routen via Middleware)
- ✅ Board-UI (dynamische Spalten-Tabelle, Task anlegen/bearbeiten, Kommentare)
- ✅ Spiegelungs-Agent (`lib/agent/mirror.ts`) — serverseitig, mit Prompt-Injection-
  Schutz und enger Tool-Fläche; läuft nach dem Anlegen eines Kunden-Tasks

Zum Live-Betrieb fehlt noch ein Supabase-Projekt (Migrationen anwenden, Keys in
`.env.local`) und ein `ANTHROPIC_API_KEY` für den Agenten (ohne Key ist der Agent
inaktiv, die App läuft trotzdem).
