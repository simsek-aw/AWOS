-- Saved agent conversations (assistant / creative), per user. Messages are kept
-- as a jsonb array on the row — threads are short and always loaded whole.
create table if not exists agent_chats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  agent      text not null,                         -- 'assistant' | 'creative'
  title      text,
  messages   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_chats_user_agent_idx
  on agent_chats (user_id, agent, updated_at desc);

alter table agent_chats enable row level security;
alter table agent_chats force row level security;

-- Employees manage only their own chats.
do $$ begin
  create policy agent_chats_select on agent_chats
    for select using (user_id = auth.uid() and is_employee());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy agent_chats_insert on agent_chats
    for insert with check (user_id = auth.uid() and is_employee());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy agent_chats_update on agent_chats
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy agent_chats_delete on agent_chats
    for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
