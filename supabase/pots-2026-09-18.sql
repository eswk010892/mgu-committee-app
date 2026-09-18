-- ============================================================================
--  Ganesh Utsav: SPONSORSHIP POTS
--  Additive migration. Run once in the Supabase SQL editor, after
--  sponsorships.sql and updates-2026-09-10.sql. Safe to re-run.
--
--  A pot is a catalogue item that many donors chip into, instead of one donor
--  taking the whole thing. The item's amount is the target. Each contribution
--  is its own request (kind = 'pot'), confirmed or declined like any other, and
--  the pot's balance goes down as pledges arrive.
--
--  raised and backers live on the item row, not in a view over the requests,
--  because the requests table is private (donor email and phone) and the
--  catalogue is what the public can read and what realtime already broadcasts.
--  They are only ever written by refresh_pot(), from inside the gates below.
--
--  A pending pledge counts against the pot straight away, the same way a
--  pending request already takes a single item off the shelf. Declining it
--  puts the money back.
-- ============================================================================

alter table sponsorship_items add column if not exists pooled  boolean not null default false;
alter table sponsorship_items add column if not exists raised  numeric not null default 0;
alter table sponsorship_items add column if not exists backers int     not null default 0;

-- Contributions to a pot are kind 'pot'.
alter table sponsorship_requests drop constraint if exists sponsorship_requests_kind_check;
alter table sponsorship_requests add  constraint sponsorship_requests_kind_check
  check (kind in ('item','general','pot'));

-- The double-booking guard stays, but only for whole items. A pot takes many
-- live requests by design.
drop index if exists sponsorship_requests_one_live_per_item;
create unique index sponsorship_requests_one_live_per_item
  on sponsorship_requests(item_id)
  where item_id is not null and kind = 'item' and status in ('pending','confirmed');

-- ---------------------------------------------------------------------------
-- Recount a pot from its live requests. Recomputed rather than incremented, so
-- it can never drift, whatever order confirms and declines happen in.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_pot(p_item_id uuid)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_sum numeric; v_n int;
begin
  select coalesce(sum(amount), 0), count(*) into v_sum, v_n
    from sponsorship_requests
   where item_id = p_item_id and kind = 'pot' and status in ('pending','confirmed');

  update sponsorship_items
     set raised  = v_sum,
         backers = v_n,
         status  = case when amount > 0 and v_sum >= amount then 'taken' else 'available' end
   where id = p_item_id and pooled;
end $fn$;

revoke all on function public.refresh_pot(uuid) from public;

-- ---------------------------------------------------------------------------
-- SUBMIT: same signature as before, with a pot branch.
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
as $fn$
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
    -- Row lock: two donors chipping into the same pot at once are taken one
    -- after the other, so the second sees the first one's pledge.
    select * into v_item from sponsorship_items where id = p_item_id for update;
    if not found then return 'no-such-item'; end if;
    v_label := v_item.title;
    v_day   := v_item.day_index;

    if v_item.pooled then
      v_kind := 'pot';
      if v_amount is null or v_amount <= 0 then return 'bad-amount'; end if;
      if v_item.amount > 0 then
        if v_item.raised >= v_item.amount then return 'item-taken'; end if;
        if v_amount > v_item.amount - v_item.raised then return 'over-pot'; end if;
      end if;
    else
      if v_item.status <> 'available' then return 'item-taken'; end if;
      v_kind := 'item';
      -- A priced item is sponsored at its listed price. Only open-amount items
      -- (amount 0) take the figure the donor typed.
      if v_item.amount > 0 then v_amount := v_item.amount; end if;
    end if;
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

  if v_kind = 'pot' then
    perform refresh_pot(p_item_id);
  elsif v_kind = 'item' then
    -- Take the item off the shelf straight away. Without this a second donor
    -- fills in the whole form before being told it is gone.
    update sponsorship_items set status = 'pending' where id = p_item_id;
  end if;

  return 'ok';
end $fn$;

revoke all on function public.submit_sponsorship(uuid,text,text,numeric,text,text,text,text,boolean,int) from public;
grant execute on function public.submit_sponsorship(uuid,text,text,numeric,text,text,text,text,boolean,int)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- CONFIRM: a pot contribution becomes a donation like anything else, but it
-- does not stamp one donor's name on the whole pot.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_sponsorship(p_request_id uuid)
returns text
language plpgsql security definer set search_path = public
as $fn$
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
    if v_req.kind = 'pot' then
      -- Re-confirming a declined pledge brings it back into the pot.
      perform refresh_pot(v_req.item_id);
    else
      update sponsorship_items
         set status = 'taken', sponsor_name = v_public
       where id = v_req.item_id;
    end if;
  end if;

  return 'ok';
end $fn$;

revoke all on function public.confirm_sponsorship(uuid) from public;
grant execute on function public.confirm_sponsorship(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- DECLINE: a pot contribution puts its money back in the pot.
-- ---------------------------------------------------------------------------
create or replace function public.decline_sponsorship(p_request_id uuid)
returns text
language plpgsql security definer set search_path = public
as $fn$
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
    if v_req.kind = 'pot' then
      perform refresh_pot(v_req.item_id);
    else
      update sponsorship_items
         set status = 'available', sponsor_name = null
       where id = v_req.item_id;
    end if;
  end if;

  return 'ok';
end $fn$;

revoke all on function public.decline_sponsorship(uuid) from public;
grant execute on function public.decline_sponsorship(uuid) to authenticated;
