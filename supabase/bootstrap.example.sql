-- ============================================================================
-- AWOS — Bootstrap (Erststart)
-- Anlegen des ersten Mitarbeiters, der internen Boards und eines Demo-Kunden.
--
-- Voraussetzung: Die drei Migrationen aus supabase/migrations/ wurden bereits
-- angewendet (siehe Anleitung).
--
-- Schritt A: Lege in Supabase unter Authentication -> Users ("Add user")
--   deinen Mitarbeiter-Account an (E-Mail + Passwort, "Auto Confirm" an).
-- Schritt B: Kopiere die User-UID dieses Accounts und trage sie unten ein.
-- Schritt C: Führe dieses Skript im SQL-Editor aus.
-- ============================================================================

-- >>> HIER die UID des angelegten Auth-Users eintragen:
-- (Authentication -> Users -> auf den User klicken -> "User UID")
\set employee_uid '00000000-0000-0000-0000-000000000000'

-- 1) Ersten Mitarbeiter provisionieren (Zugriff auf ALLE Boards)
select provision_profile(
  :'employee_uid'::uuid,
  'Erster Mitarbeiter',   -- Anzeigename anpassen
  'employee'
);

-- 2) Interne Boards je Abteilung (mit Standard-Spalten)
select create_board('Intern — Marketing', 'internal', null, 'marketing');
select create_board('Intern — Content',   'internal', null, 'content');
select create_board('Intern — Grafik',    'internal', null, 'grafik');

-- 3) Ein Demo-Kunde + sein Board
do $$
declare
  v_customer uuid;
begin
  insert into customers (name) values ('Demo Kunde') returning id into v_customer;
  perform create_board('Demo Kunde', 'customer', v_customer, null);
end $$;

-- Fertig. Melde dich in der App mit der E-Mail/dem Passwort aus Schritt A an —
-- du solltest als Mitarbeiter alle vier Boards sehen.
--
-- Einen KUNDEN-Login anlegen: neuen Auth-User erstellen, dann:
--   select provision_profile('<kunden-user-uid>'::uuid, 'Kundenname', 'customer',
--                             '<customer-id aus Schritt 3>'::uuid);
-- Die customer-id findest du per:  select id, name from customers;
