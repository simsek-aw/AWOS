-- AWideogram: image generation on top of Ideogram 4.0 (with layout control).
--
-- Generated images are stored in a private storage bucket; metadata + the
-- structured request (json_prompt) live here so the team has a persistent
-- gallery even after Ideogram's own hosted URLs expire. Employee-only tool.
create table if not exists awideogram_generations (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references profiles (id) on delete set null,
  storage_path          text not null,
  high_level_description text,
  request               jsonb,          -- the full body we sent to Ideogram
  aspect_ratio          text,
  rendering_speed       text,
  created_at            timestamptz not null default now()
);

create index if not exists awideogram_generations_created_idx
  on awideogram_generations (created_at desc);

alter table awideogram_generations enable row level security;
alter table awideogram_generations force row level security;

-- Shared team gallery: any employee can see generations. Inserts happen through
-- the server action (service role), so no insert policy is needed.
drop policy if exists awideogram_select on awideogram_generations;
create policy awideogram_select on awideogram_generations
  for select to authenticated
  using (is_employee());

drop policy if exists awideogram_delete on awideogram_generations;
create policy awideogram_delete on awideogram_generations
  for delete to authenticated
  using (is_employee());

-- Private bucket for the rendered images. Uploads/reads go through the service
-- role in the server action, so we don't need object-level policies here.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
      values ('awideogram', 'awideogram', false)
      on conflict (id) do nothing;
  end if;
end $$;
