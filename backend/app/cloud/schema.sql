-- Aether Vision cloud sync schema (run in Supabase SQL editor).
-- RLS: users may only touch their own rows. Service role bypasses RLS.

create table if not exists public.aether_sessions (
  user_id text primary key,
  profile_id text not null default 'local',
  preferences jsonb not null default '{}'::jsonb,
  hud jsonb not null default '{}'::jsonb,
  device_id text,
  updated_at double precision not null default extract(epoch from now())
);

create table if not exists public.aether_hud_events (
  id text primary key,
  user_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  device_id text,
  created_at double precision not null default extract(epoch from now())
);

create index if not exists aether_hud_events_user_created_idx
  on public.aether_hud_events (user_id, created_at desc);

alter table public.aether_sessions enable row level security;
alter table public.aether_hud_events enable row level security;

drop policy if exists aether_sessions_own on public.aether_sessions;
create policy aether_sessions_own on public.aether_sessions
  for all using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

drop policy if exists aether_hud_events_own on public.aether_hud_events;
create policy aether_hud_events_own on public.aether_hud_events
  for all using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Optional: alter publication supabase_realtime add table aether_hud_events;
