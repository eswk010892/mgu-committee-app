-- ============================================================================
--  Ganesh Utsav — SEPTEMBER 2026 UPDATES
--  Additive migration. Run once in the Supabase SQL editor, after schema.sql
--  and sponsorships.sql. Safe to re-run.
--
--  Nothing here drops a column or deletes a row. The old interac_answer column
--  is left exactly as it is — the app simply stops reading it.
--
--  What it does:
--    1. festival_config.interac_name — the bank account name shown to donors
--       in place of the e-Transfer security answer.
--    2. committee_members.is_admin + is_admin() — the festival settings become
--       admin-only. Everything else stays open to every member.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. BANK ACCOUNT NAME
--
-- The e-Transfer address is set up for auto-deposit, so there is no security
-- question to answer. What a donor needs before sending money is confirmation
-- of who receives it, so the donor page shows the account name instead.
--
-- interac_answer is deliberately NOT dropped: it is committee data, and a
-- column nobody reads costs nothing. Clear it by hand if you want it gone.
-- ---------------------------------------------------------------------------
alter table festival_config add column if not exists interac_name text;

-- The real account name is NOT seeded here. This repository is public, and the
-- same rule that keeps interac_email and the invite codes out of it applies to
-- the account name: payment details are configuration, not code. Set it from
-- Setup -> Sponsorship payment details (no redeploy), or run:
--
--   update festival_config set interac_name = 'THE ACCOUNT NAME' where id = 1;
--
-- Until it is set, the donor page shows the e-Transfer address on its own,
-- exactly as it did before this change.

-- ---------------------------------------------------------------------------
-- 2. ADMINS
--
-- Membership still grants full day-to-day access — programme, tasks, donations,
-- sponsorships. What is now admin-only is festival_config: the name, the dates,
-- the day count, the goal and the payment details. Those change the festival
-- for everybody and for every visitor to the public link.
--
-- The bootstrap clause matters: while NO member is flagged as an admin, every
-- member counts as one. Without it, running this on a database whose admins
-- have not been set yet would lock the whole committee out of Setup. The app
-- applies the same fallback, so the screen and the database always agree.
-- ---------------------------------------------------------------------------
alter table committee_members add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from committee_members where user_id = auth.uid() and is_admin)
      or not exists (select 1 from committee_members where is_admin)
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- festival_config: public read as before, but admin-only write.
drop policy if exists "festival_config committee write" on festival_config;
drop policy if exists "festival_config admin write"     on festival_config;
create policy "festival_config admin write" on festival_config
  for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- WHO IS AN ADMIN
--
-- Vamsi, Abhi and Arun. Matched on the name each of them typed when joining,
-- because that is the only identifier this table holds. RUN THE SELECT FIRST
-- and check it returns those three people and nobody else — 'arun%' would also
-- match an Aruna, and a member who joined as "A. Rao" will not match at all.
--
--   select user_id, name, role, is_admin from committee_members order by name;
--
-- Then grant, by name:
--
--   update committee_members set is_admin = true
--    where name ilike 'vamsi%' or name ilike 'abhi%' or name ilike 'arun%';
--
-- or, more precisely, by the exact user ids from that select:
--
--   update committee_members set is_admin = true
--    where user_id in ('...', '...', '...');
--
-- To take admin away from someone (this does not remove them from the
-- committee, only their access to the settings):
--
--   update committee_members set is_admin = false where user_id = '...';
--
-- Careful: setting the last remaining admin back to false re-opens Setup to
-- every member, by the bootstrap rule above.
-- ---------------------------------------------------------------------------
