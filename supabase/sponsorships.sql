-- ============================================================================
--  Ganesh Utsav — SPONSORSHIPS
--  Additive migration. Run once in the Supabase SQL editor, after schema.sql.
--  Safe to re-run.
--
--  Two tables:
--    sponsorship_items     the catalogue — public, so donors can browse it.
--    sponsorship_requests  who asked for what — PRIVATE. Holds donor email and
--                          phone, so there is no anon read policy at all and it
--                          is deliberately kept out of the realtime publication.
--
--  The public never writes to either table directly. Submissions go through
--  submit_sponsorship(), a security-definer gate that validates the amount and
--  refuses an item somebody has already claimed. Same shape as join_committee().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PAYMENT DETAILS
-- Where a donor sends an Interac e-Transfer, and the security answer to use.
--
-- These live in the database, NOT in the source, for the same reason the invite
-- code does: this repository is public. Keeping them here also means the
-- committee can rotate the answer from the Setup tab without a deploy.
--
-- festival_config is public-read by design, which is correct — every donor has
-- to be told the answer for the transfer to work at all. The security of the
-- account rests on the inbox that receives the deposit link, not on this string.
-- Set the real values from Setup, or with:
--
--   update festival_config
--      set interac_email = 'you@example.com', interac_answer = 'YourAnswer'
--    where id = 1;
-- ---------------------------------------------------------------------------
alter table festival_config add column if not exists interac_email  text;
alter table festival_config add column if not exists interac_answer text;
alter table festival_config add column if not exists contact_email  text;

-- Shown under the festival name on the board and the public page. Editable from
-- Setup so the committee can reword it without a deploy.
alter table festival_config add column if not exists description    text;

-- ---------------------------------------------------------------------------
-- THE CATALOGUE  (public read)
-- day_index is 0-based to match events.day. NULL means "general / any day".
-- amount 0 means "open amount — donor names their own figure".
-- ---------------------------------------------------------------------------
create table if not exists sponsorship_items (
  id           uuid primary key default gen_random_uuid(),
  day_index    int,
  category     text not null default 'General',
  title        text not null,
  amount       numeric not null default 0 check (amount >= 0),
  note         text,
  status       text not null default 'available' check (status in ('available','pending','taken')),
  sponsor_name text,
  show_public  boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists sponsorship_items_day_idx on sponsorship_items(day_index, sort_order);

-- ---------------------------------------------------------------------------
-- THE REQUESTS  (committee read only — contains donor contact details)
-- item_label / item_day are snapshots taken at submit time, so the record still
-- reads correctly if the catalogue entry is later renamed or deleted.
-- amount is NOT NULL and must be positive: a request with no money on it is
-- not a request, and the committee cannot chase what it cannot see.
-- ---------------------------------------------------------------------------
create table if not exists sponsorship_requests (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid references sponsorship_items(id) on delete set null,
  item_label   text,
  item_day     int,
  kind         text not null check (kind in ('item','general')),
  donor_name   text not null,
  org          text,
  email        text not null,
  -- Nullable at the column, required by submit_sponsorship(). Rows created
  -- before the phone became mandatory (2026-09-03) still have NULL here, and
  -- they are real committee records — not something to backfill with a fake
  -- number just to satisfy a constraint.
  phone        text,
  amount       numeric not null check (amount > 0),
  pay_method   text not null,
  show_name    boolean not null default true,
  message      text,
  status       text not null default 'pending' check (status in ('pending','confirmed','declined')),
  donation_id  uuid references donations(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists sponsorship_requests_created_idx on sponsorship_requests(created_at desc);

-- One live claim per catalogue item. A declined request frees the item again.
-- This is the double-booking guard: two donors racing for the same item means
-- the second insert fails outright rather than both being told "yes".
create unique index if not exists sponsorship_requests_one_live_per_item
  on sponsorship_requests(item_id)
  where item_id is not null and status in ('pending','confirmed');

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table sponsorship_items    enable row level security;
alter table sponsorship_requests enable row level security;

drop policy if exists "sponsorship_items public read"      on sponsorship_items;
drop policy if exists "sponsorship_items committee write"  on sponsorship_items;
drop policy if exists "sponsorship_requests committee read"  on sponsorship_requests;
drop policy if exists "sponsorship_requests committee write" on sponsorship_requests;

-- The catalogue is meant to be browsed by the public.
create policy "sponsorship_items public read" on sponsorship_items
  for select to anon, authenticated using (true);
create policy "sponsorship_items committee write" on sponsorship_items
  for all to authenticated using (is_committee()) with check (is_committee());

-- Requests: committee only. No anon policy at all, so the public API cannot
-- read donor emails or phone numbers, or even confirm that a request exists.
create policy "sponsorship_requests committee read" on sponsorship_requests
  for select to authenticated using (is_committee());
create policy "sponsorship_requests committee write" on sponsorship_requests
  for all to authenticated using (is_committee()) with check (is_committee());

-- ---------------------------------------------------------------------------
-- PUBLIC SUBMISSION GATE
-- Anonymous visitors cannot INSERT into sponsorship_requests. They call this
-- instead, which validates everything the browser cannot be trusted to check.
-- ---------------------------------------------------------------------------
create or replace function public.submit_sponsorship(
  p_item_id    uuid,
  p_donor_name text,
  p_email      text,
  p_amount     numeric,
  p_pay_method text,
  p_org        text default null,
  p_phone      text default null,
  p_message    text default null,
  p_show_name  boolean default true,
  p_day        int default null
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_item   sponsorship_items%rowtype;
  v_kind   text := 'general';
  v_label  text := 'General sponsorship';
  v_day    int  := p_day;
  v_amount numeric := p_amount;
begin
  if p_donor_name is null or length(trim(p_donor_name)) = 0 then return 'no-name'; end if;
  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return 'bad-email';
  end if;
  if p_phone is null or length(trim(p_phone)) < 7 then return 'no-phone'; end if;
  if p_pay_method is null or length(trim(p_pay_method)) = 0 then return 'no-pay-method'; end if;

  if p_item_id is not null then
    select * into v_item from sponsorship_items where id = p_item_id;
    if not found then return 'no-such-item'; end if;
    if v_item.status <> 'available' then return 'item-taken'; end if;
    v_kind  := 'item';
    v_label := v_item.title;
    v_day   := v_item.day_index;
    -- A priced item is sponsored at its listed price. Only open-amount items
    -- (amount 0) take the figure the donor typed.
    if v_item.amount > 0 then v_amount := v_item.amount; end if;
  end if;

  if v_amount is null or v_amount <= 0 then return 'bad-amount'; end if;

  begin
    insert into sponsorship_requests
      (item_id, item_label, item_day, kind, donor_name, org, email, phone,
       amount, pay_method, show_name, message)
    values
      (p_item_id, v_label, v_day, v_kind, trim(p_donor_name), nullif(trim(coalesce(p_org,'')),''),
       lower(trim(p_email)), trim(p_phone),
       v_amount, p_pay_method, coalesce(p_show_name, true),
       nullif(trim(coalesce(p_message,'')),''));
  exception when unique_violation then
    return 'item-taken';
  end;

  -- Take the item off the shelf straight away. Without this a second donor
  -- fills in the whole form before being told it is gone.
  if p_item_id is not null then
    update sponsorship_items set status = 'pending' where id = p_item_id;
  end if;

  return 'ok';
end $$;

revoke all on function public.submit_sponsorship(uuid,text,text,numeric,text,text,text,text,boolean,int) from public;
grant execute on function public.submit_sponsorship(uuid,text,text,numeric,text,text,text,text,boolean,int)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- CONFIRM  (committee only)
-- Turns a request into a real donation so it counts toward the goal and shows
-- in the public feed. The donor's real name goes to donation_private when the
-- gift is anonymous, exactly like a hand-entered donation.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_sponsorship(p_request_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_req      sponsorship_requests%rowtype;
  v_donation uuid;
  v_public   text;
begin
  if not is_committee() then return 'not-allowed'; end if;

  select * into v_req from sponsorship_requests where id = p_request_id;
  if not found then return 'no-such-request'; end if;
  if v_req.status = 'confirmed' then return 'already-confirmed'; end if;

  v_public := case when v_req.show_name
                   then coalesce(nullif(v_req.org,''), v_req.donor_name)
                   else 'Anonymous' end;

  insert into donations (donor, kind, category, amount, donated_on)
  values (v_public, 'money', v_req.pay_method, v_req.amount, current_date)
  returning id into v_donation;

  insert into donation_private (donation_id, real_name, note)
  values (v_donation, v_req.donor_name,
          'Sponsorship: ' || coalesce(v_req.item_label,'General')
            || ' · ' || v_req.email || coalesce(' · ' || v_req.phone, ''))
  on conflict (donation_id) do nothing;

  update sponsorship_requests
     set status = 'confirmed', donation_id = v_donation
   where id = p_request_id;

  if v_req.item_id is not null then
    update sponsorship_items
       set status = 'taken', sponsor_name = v_public
     where id = v_req.item_id;
  end if;

  return 'ok';
end $$;

revoke all on function public.confirm_sponsorship(uuid) from public;
grant execute on function public.confirm_sponsorship(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- DECLINE / REOPEN  (committee only)
-- Releases the item so somebody else can claim it, and removes the donation
-- row if the request had already been confirmed.
-- ---------------------------------------------------------------------------
create or replace function public.decline_sponsorship(p_request_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_req sponsorship_requests%rowtype;
begin
  if not is_committee() then return 'not-allowed'; end if;

  select * into v_req from sponsorship_requests where id = p_request_id;
  if not found then return 'no-such-request'; end if;

  update sponsorship_requests
     set status = 'declined', donation_id = null
   where id = p_request_id;

  if v_req.donation_id is not null then
    delete from donations where id = v_req.donation_id;   -- cascades to donation_private
  end if;

  if v_req.item_id is not null then
    update sponsorship_items
       set status = 'available', sponsor_name = null
     where id = v_req.item_id;
  end if;

  return 'ok';
end $$;

revoke all on function public.decline_sponsorship(uuid) from public;
grant execute on function public.decline_sponsorship(uuid) to authenticated;

-- ============================================================================
--  REALTIME — the catalogue only.
--  sponsorship_requests is deliberately NOT published: it carries donor email
--  and phone. The committee board re-pulls on any catalogue change and after
--  its own writes, which is enough.
-- ============================================================================
do $$
begin
  begin execute 'alter publication supabase_realtime add table sponsorship_items';
  exception when others then null; end;
end $$;
