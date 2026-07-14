-- ============================================================================
-- AWOS — 0007 attachments (Supabase Storage)
-- File uploads on tasks. Access follows board access, exactly like tasks and
-- comments: a customer can only touch files on their own board.
--
-- Storage layout: attachments/<board_id>/<task_id>/<uuid>-<filename>
-- The board_id is the first path segment, so storage policies can authorize by
-- reusing can_access_board() — the same predicate used everywhere else.
-- ============================================================================

-- --- Metadata table ---------------------------------------------------------

create table attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks (id) on delete cascade,
  storage_path text not null unique,
  file_name    text not null,
  size_bytes   bigint,
  content_type text,
  uploaded_by  uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index attachments_task_id_idx on attachments (task_id);

alter table attachments enable row level security;
alter table attachments force row level security;

create policy attachments_select on attachments for select to authenticated
  using (exists (select 1 from tasks t
                 where t.id = attachments.task_id and can_access_board(t.board_id)));

create policy attachments_insert on attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (select 1 from tasks t
                where t.id = attachments.task_id and can_access_board(t.board_id))
  );

create policy attachments_delete on attachments for delete to authenticated
  using (uploaded_by = auth.uid() or is_employee());

-- --- Realtime ---------------------------------------------------------------

do $$
begin
  execute 'alter table public.attachments replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attachments'
  ) then
    execute 'alter publication supabase_realtime add table public.attachments';
  end if;
end $$;

-- --- Storage bucket + object policies ---------------------------------------
-- Guarded so this migration also applies on a plain Postgres (no storage schema)
-- during local verification; on Supabase the storage schema always exists.

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
      values ('attachments', 'attachments', false)
      on conflict (id) do nothing;

    -- Reads: only within a board the caller can access.
    execute $p$
      create policy "attachments_read" on storage.objects for select to authenticated
        using (
          bucket_id = 'attachments'
          and can_access_board(((storage.foldername(name))[1])::uuid)
        )$p$;

    -- Uploads: same board-access check.
    execute $p$
      create policy "attachments_write" on storage.objects for insert to authenticated
        with check (
          bucket_id = 'attachments'
          and can_access_board(((storage.foldername(name))[1])::uuid)
        )$p$;

    -- Deletes: uploader (object owner) or any employee.
    execute $p$
      create policy "attachments_remove" on storage.objects for delete to authenticated
        using (
          bucket_id = 'attachments'
          and (is_employee() or owner = auth.uid())
        )$p$;
  end if;
end $$;
