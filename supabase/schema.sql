-- ============================================================================
--  Ganesh Utsav Committee Board — database schema
--  Run once in the Supabase SQL editor (Project -> SQL Editor -> New query).
--  Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- WHO IS ON THE COMMITTEE
-- A signed-in user only gets edit rights if their uid appears in this table.
-- Someone signing up on their own gets nothing until you add them here.
-- ---------------------------------------------------------------------------
create table if not exists committee_members (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  role        text,
  phone       text,
  -- Membership grants full day-to-day access. is_admin grants one thing on top
  -- of it: changing festival_config. See is_admin() below.
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table committee_members add column if not exists is_admin boolean not null default false;

-- security definer so policies can call it without recursing into RLS
create or replace function public.is_committee()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from committee_members where user_id = auth.uid()) $$;

revoke all on function public.is_committee() from public;
grant execute on function public.is_committee() to anon, authenticated;

-- Admins may change the festival settings — name, dates, day count, goal and
-- the sponsorship payment details. Everything else stays open to every member.
--
-- While NO member is flagged as an admin, every member counts as one, so a
-- fresh install is not locked out of Setup before anybody has been named. The
-- app applies the same fallback, so the screen and the database agree.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  -- Membership first: sign-up is open, so the bootstrap fallback must never
  -- reach an account that has no committee_members row.
  select exists (
    select 1 from committee_members me
     where me.user_id = auth.uid()
       and (me.is_admin or not exists (select 1 from committee_members where is_admin))
  )
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- FESTIVAL SETTINGS  (public: name, dates, day count)
-- ---------------------------------------------------------------------------
create table if not exists festival_config (
  id          int primary key default 1 check (id = 1),
  name        text not null default 'Ganesh Utsav',
  start_date  date not null default current_date,
  days        int  not null default 5,
  goal        numeric not null default 0,
  updated_at  timestamptz not null default now()
);
insert into festival_config (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- PROGRAMME  (public)
-- Anything written here is visible to the whole internet.
-- Internal remarks go in event_notes below.
-- ---------------------------------------------------------------------------
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  day         int  not null,
  start_time  text,
  title       text not null,
  place       text,
  lead        text,
  created_at  timestamptz not null default now()
);
create index if not exists events_day_idx on events(day);

create table if not exists event_notes (
  event_id  uuid primary key references events(id) on delete cascade,
  notes     text
);

-- ---------------------------------------------------------------------------
-- DONATIONS
--   donations          -> PUBLIC. donor shown here is the DISPLAY name.
--                         For an anonymous gift the app writes 'Anonymous'
--                         and keeps the real name in donation_private.
--   donation_private   -> COMMITTEE ONLY. Real name, receipt no., remarks.
--                         anon has no policy on this table at all, so it is
--                         invisible to the public API and to realtime.
-- ---------------------------------------------------------------------------
create table if not exists donations (
  id          uuid primary key default gen_random_uuid(),
  donor       text not null,
  kind        text not null check (kind in ('money','goods')),
  category    text not null,
  amount      numeric,
  item        text,
  qty         text,
  donated_on  date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists donations_created_idx on donations(created_at desc);

create table if not exists donation_private (
  donation_id uuid primary key references donations(id) on delete cascade,
  real_name   text,
  receipt_no  text,
  note        text
);

-- ---------------------------------------------------------------------------
-- TASKS  (committee only — never public)
-- Any committee member may add, edit, assign or close any task.
-- ---------------------------------------------------------------------------
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null default 'Other',
  owner       text,
  due_date    date,
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  created_by  text,
  created_at  timestamptz not null default now()
);

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table committee_members enable row level security;
alter table festival_config   enable row level security;
alter table events            enable row level security;
alter table event_notes       enable row level security;
alter table donations         enable row level security;
alter table donation_private  enable row level security;
alter table tasks             enable row level security;

do $$
declare t text;
begin
  foreach t in array array['committee_members','festival_config','events','event_notes',
                           'donations','donation_private','tasks']
  loop
    execute format('drop policy if exists "%s public read" on %I', t, t);
    execute format('drop policy if exists "%s committee read" on %I', t, t);
    execute format('drop policy if exists "%s committee write" on %I', t, t);
    execute format('drop policy if exists "%s admin write" on %I', t, t);
  end loop;
end $$;

-- Public (not signed in) may READ only these three tables.
create policy "festival_config public read" on festival_config
  for select to anon, authenticated using (true);
create policy "events public read" on events
  for select to anon, authenticated using (true);
create policy "donations public read" on donations
  for select to anon, authenticated using (true);

-- Committee-only tables: no anon policy at all.
create policy "committee_members committee read" on committee_members
  for select to authenticated using (is_committee());
create policy "event_notes committee read" on event_notes
  for select to authenticated using (is_committee());
create policy "donation_private committee read" on donation_private
  for select to authenticated using (is_committee());
create policy "tasks committee read" on tasks
  for select to authenticated using (is_committee());

-- Writes: committee members only, everywhere.
-- The settings are the one thing a member cannot change: they alter the
-- festival for everybody, and for every visitor to the public link.
create policy "festival_config admin write" on festival_config
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "events committee write" on events
  for all to authenticated using (is_committee()) with check (is_committee());
create policy "event_notes committee write" on event_notes
  for all to authenticated using (is_committee()) with check (is_committee());
create policy "donations committee write" on donations
  for all to authenticated using (is_committee()) with check (is_committee());
create policy "donation_private committee write" on donation_private
  for all to authenticated using (is_committee()) with check (is_committee());
create policy "tasks committee write" on tasks
  for all to authenticated using (is_committee()) with check (is_committee());
create policy "committee_members committee write" on committee_members
  for all to authenticated using (is_committee()) with check (is_committee());

-- ============================================================================
--  REALTIME — publish only the three public tables.
-- ============================================================================
do $$
begin
  begin execute 'alter publication supabase_realtime add table festival_config'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table events';          exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table donations';       exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table tasks';           exception when others then null; end;
end $$;

-- ============================================================================
--  SELF-SERVE JOIN — invite codes
--  Members join from the app with a shared code (sent in the committee
--  WhatsApp group) instead of an admin creating each account by hand.
--  The code is the gate; RLS stays exactly as above. Seed a code with:
--
--     insert into invite_codes (code, expires_on, max_uses)
--     values ('YOUR-CODE-HERE', '2026-09-30', 15);
--
--  Rotate by deleting/inserting rows. Do NOT commit real code values.
-- ---------------------------------------------------------------------------
create table if not exists invite_codes (
  code        text primary key,
  expires_on  date not null,
  max_uses    int  not null default 15,
  uses        int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table invite_codes enable row level security;
drop policy if exists "invite_codes committee read" on invite_codes;
create policy "invite_codes committee read" on invite_codes
  for select to authenticated using (is_committee());
drop policy if exists "invite_codes committee write" on invite_codes;
create policy "invite_codes committee write" on invite_codes
  for all to authenticated using (is_committee()) with check (is_committee());
-- No anon policy at all: the public API cannot even see that codes exist.

-- Called by the app after sign-up/sign-in. security definer so a not-yet-member
-- can be inserted into committee_members — but only through this gate.
create or replace function public.join_committee(invite text, member_name text, member_phone text default null)
returns text
language plpgsql security definer set search_path = public
as $$
declare hit int;
begin
  if auth.uid() is null then return 'not-signed-in'; end if;
  if exists (select 1 from committee_members where user_id = auth.uid()) then
    return 'already-member';
  end if;
  if member_name is null or length(trim(member_name)) = 0 then
    return 'name-required';
  end if;
  -- Case-insensitive; the atomic update is also the use-counter.
  update invite_codes
     set uses = uses + 1
   where upper(code) = upper(trim(invite))
     and expires_on >= current_date
     and uses < max_uses;
  get diagnostics hit = row_count;
  if hit = 0 then return 'bad-code'; end if;
  insert into committee_members (user_id, name, role, phone)
  values (auth.uid(), trim(member_name), 'Member', nullif(trim(member_phone), ''));
  return 'ok';
end $$;

revoke all on function public.join_committee(text, text, text) from public;
grant execute on function public.join_committee(text, text, text) to authenticated;

-- ============================================================================
--  ADDING A COMMITTEE MEMBER (manual fallback)
--  Normal path: share the invite code + app link; members join themselves.
--  By hand instead:
--  1. Authentication -> Users -> Add user (email + password), or invite them.
--  2. Copy their User UID and run:
--
--     insert into committee_members (user_id, name, role, phone)
--     values ('paste-uid-here', 'Vishal', 'Cricket lead', '+1 438-680-0166');
--
--  To remove someone's access:  delete from committee_members where user_id = '...';
-- ============================================================================
