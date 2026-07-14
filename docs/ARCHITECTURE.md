# AWOS — Architektur

Dieses Dokument beschreibt das Datenmodell und die Informationsflüsse. Der Fokus liegt
auf der Trennung zwischen **Kundenwelt** und **interner Welt**, weil daran der gesamte
Wert (und das gesamte Risiko) der Plattform hängt.

## 1. Rollen

| Rolle      | Zugriff                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| `employee` | Alle Boards (Kunden-Boards **und** internes Board), inkl. interner Kommentare |
| `customer` | Ausschließlich das eine Board des eigenen Kunden                        |

Ein `customer`-Profil ist über `customer_id` genau einem Kunden zugeordnet. Ein
`employee`-Profil hat `customer_id = NULL` und optional eine `department`
(marketing/content/grafik).

## 2. Datenmodell (Überblick)

```
customers ─┐
           │ 1
           ▼ n
profiles   boards ──1:n── columns
   │         │ 1
   │         ▼ n
   │        tasks ──1:n── task_values ──n:1── columns
   │         │ │
   │         │ └──1:n── comments
   │         │
   │         └── task_links (customer_task_id ↔ internal_task_id)
   ▼
audit_log
```

### Kern-Tabellen

- **customers** — die Kundenfirmen der Agentur (der Mandant/Tenant).
- **profiles** — erweitert Supabase `auth.users` um Rolle, `customer_id`, `department`.
- **boards** — `type = 'customer'` (mit `customer_id`) oder `type = 'internal'`
  (mit optionaler `department`).
- **columns** — pro Board frei konfigurierbare Spalten. Standard-Spalten werden beim
  Anlegen eines Boards geseedet: Task-ID, Name, PM, Macher, Status, Deadline, OneDrive.
- **tasks** — ein Task gehört zu genau einem Board.
- **task_values** — flexible Spaltenwerte (EAV: `task_id` + `column_id` → `value` jsonb).
- **comments** — Kommentare an einem Task. **Kein** Sichtbarkeits-Flag (siehe §4).
- **task_links** — verknüpft einen Kunden-Task mit seinem gespiegelten internen Task.
- **audit_log** — protokolliert sicherheitsrelevante Aktionen.

## 3. Der Spiegelungs-Flow

```
Kunde erstellt Task            Agent (serverseitig)              Team arbeitet intern
im Kunden-Board          ──►   prüft Relevanz, legt        ──►  bearbeitet & kommentiert
(tasks + comments)             internen Task an                 den INTERNEN Task
                               (tasks + task_links)             (comments am internen Task)
                                                                        │
                                                                        ▼
                                                     Ergebnis fertig → Agent/Mensch postet
                                                     kurzen Kommentar + Status am
                                                     KUNDEN-Task (nicht am internen)
```

Wichtig: Der Kunden-Task und der interne Task sind **zwei verschiedene Zeilen** in
`tasks`, verbunden über `task_links`. Interne Kommentare hängen physisch am internen
Task, der in einem `internal`-Board liegt — auf das ein `customer` per RLS keinen
Zugriff hat.

## 4. Warum getrennte Objekte statt Sichtbarkeits-Flag

Naiver Ansatz: ein Task, ein Kommentar-Feld, dazu ein Flag `visible_to_customer`. Das ist
gefährlich — ein einziges vergessenes oder falsch gesetztes Flag leakt interne Daten an
den Kunden.

AWOS-Ansatz: **getrennte Objekte.** Ein interner Kommentar existiert nur am internen
Task. Es gibt keinen Codepfad, über den er beim Kunden erscheinen könnte, weil die
RLS-Policy dem Kunden die gesamte Zeile verweigert. Das schlimmste Leak ist damit nicht
„abgesichert", sondern **strukturell ausgeschlossen**.

## 5. Wo der Agent andockt

Der Agent läuft **ausschließlich serverseitig** (Next.js Route Handler / Edge Function).
Er nutzt den `service_role`-Key, der RLS umgeht — deshalb ist er der privilegierteste
Akteur und wird entsprechend eng gehalten:

- Er erhält ein **enges Tool-Set** (`create_internal_task`, `link_tasks`,
  `post_customer_summary`) statt freien DB-Zugriff.
- Kunden-Input (Task-Titel, Kommentare) wird als **Daten** behandelt, nie als Anweisung
  (Schutz gegen Prompt Injection — siehe `docs/SECURITY.md`).
- Der Rückkanal (intern → Kunde) ist der sensibelste Schritt und sollte anfangs eine
  menschliche Freigabe durchlaufen.

## 6. Nächste Schritte

1. Next.js-Auth-Flow (Login, Session, `profiles`-Anlage).
2. Board-Ansicht (Tabelle mit dynamischen Spalten) + Task-Detail + Kommentare.
3. Agent-Endpoint für die Relevanzprüfung und Spiegelung.
4. Audit-Log-Trigger und Admin-Ansicht.
