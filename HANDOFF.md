# Handoff — Committee Board

**Last session:** 2026-09-10 · seven committee change requests built, **not yet deployed**

> This repository is **public**. Credentials, the Supabase project ref, invite codes
> and payment details are deliberately kept out of it — they live in the database or
> in the maintainer's private notes. Please keep it that way.

## Current state

Vite + React 18 + Supabase. Six tabs: Overview, Schedule, Tasks, **Sponsors**, Team,
Setup. Bundle **122.7 KB gzipped** plus a 12.9 KB crest asset.

**Live in production** since 2026-09-03 — schema run, donor page shipped, donors can
sponsor at `/#sponsor` today. Festival config is `days = 6` (Sep 14–19), `goal = 25000`.

**Uncommitted on top of that (2026-09-10):** seven changes asked for by the committee,
built and verified in demo mode but **not deployed**, and
`supabase/updates-2026-09-10.sql` has **not been run**. The rules those changes settled
are in Gotchas below; the measured verification is archived.

| # | Change | Where |
|---|--------|-------|
| 1 | Edit tasks and catalogue items | `Tasks.jsx`, `Sponsors.jsx` — pencil per row, inline draft form, Cancel discards |
| 2 | Bank account name replaces the e-Transfer security answer | new `festival_config.interac_name`; Setup field renamed |
| 3 | Delete a declined sponsorship request | `Sponsors.jsx` + `api.removeSponsorRequest`, behind a confirm |
| 4 | Catalogue ordered unclaimed-first, then dearest-first | `bySponsorOrder` in `format.js`, applied in `api.getSponsorItems` |
| 5 | Schedule and donor page open on today's festival day | `currentDayIndex` in `format.js` |
| 6 | No existing data destroyed | migration is additive only |
| 7 | Admin rights for three named members | `committee_members.is_admin` + `is_admin()` |

## Gotchas — things that look wrong but are correct

- **Admin gates `festival_config` and nothing else** — name, dates, day count, goal,
  payment details. Members keep the programme, tasks, donations and sponsorships, and
  Setup's backup, preview and sign-out stay open to all. Gating day-to-day work behind
  three people would be a bottleneck, not safety. Enforced in RLS, not just the UI.
- **`is_admin()` returns true for every member while nobody is flagged.** Load-bearing,
  not a hole: without it, running the migration before naming anyone locks the whole
  committee out of Setup. `App.jsx` applies the identical fallback, so screen and
  database never disagree. Clearing the last admin re-opens Setup to everybody.
- **`bySponsorOrder` lives in the data layer, not the screens.** Day (general last) →
  unclaimed before claimed → dearest first → open-amount last → order added. Applied
  once in `api.getSponsorItems` so the committee tab and the donor page cannot drift.
- **A catalogue edit never writes `status`, `sponsor_name` or `show_public`.** Those
  belong to the request queue; rewriting them would strand a confirmed sponsorship.
- **Payment details are configuration, not code.** Interac email and, since
  2026-09-10, the **bank account name** live in `festival_config`, edited from Setup.
  Not in this repo — it is public, and `updates-2026-09-10.sql` deliberately seeds no
  value. Blank email ⇒ the donor page shows no payment details at all.
- **`interac_answer` is still a column and nothing reads it.** The e-Transfer address
  is auto-deposit, so there is no question to answer; donors are shown the account name
  instead, to confirm who receives the money. The column was kept on purpose — dropping
  it would destroy committee data for no gain.
- **`sponsorship_items.status` has three values.** Dropping `pending` back to a
  boolean reintroduces the double-booking hole.
- **Config saves are a diff, and `saveConfig` is an UPDATE not an upsert.** Setup sends
  only the fields that changed. Do not "simplify" either back: the whole-row upsert plus
  `useState(cfg)` meant any member with a stale form rolled back everyone else's edits —
  it reset the festival length and goal twice on 2026-09-03. The form also re-syncs from
  `cfg` while untouched, via a `dirty` ref.
- **Phone is required by `submit_sponsorship()`, not by the column.** The column stays
  nullable because a request confirmed before 2026-09-03 has none, and that is a real
  record — not something to backfill with a fake number.
- **The public page is two tabs, Schedule and Donate**, and `.mgu-shell` widens at 1024px
  and 1440px. Schedule reuses `Garland` so a visitor picks a day rather than scrolling
  past all of them; Donate embeds the real sponsorship page plus the donor feed. From
  1024px the programme is a two-column board and those two sit side by side — a fixed
  780px column left most of a laptop screen empty.
- **The Sponsors tab has a Manage / Donor view toggle.** Donor view renders
  `SponsorPublic` with `embedded`, which drops the back bar and hero lede and boxes it as
  a card. It is live, not a mockup — submitting from there creates a real request, which
  is deliberate so a volunteer can take a sponsorship over the phone.
- **`.sp-page` scopes the light palette on purpose** — the donor page is a trial while
  the rest stays dark. If adopted, those tokens move to `:root`.
- **The reduced-motion block must stay last in `styles.css`.** Rules after it silently
  break the aarti freeze. It is currently the final rule.
- **Amount is validated twice** — `<input required>` and the SQL function. The
  database one is the real check.
- `Donations.jsx` is still on disk but no longer imported or routed.

## Open decisions

- **"Cash raised" counts confirmed requests only** — pending are promises, declined
  are not money, even though the CSV contains all three. Confirmed as the intent
  2026-09-03. Switching to total *pledged* is a one-line change in `Overview.jsx`.
- **Does the lighter donor-page look roll out to the whole app?** The sponsor page is
  the trial.
- **Whose branch is the base?** Vamsi has his own local build with a separate
  sponsorship implementation. This tree was written from scratch; his HTML was
  reference only. Agree the base before either side goes further.

## Next steps

1. **Add the real sponsorship items** — the catalogue is empty, so every day currently
   shows "Nothing listed here yet". Sponsors tab → Add.
2. **Config is `days = 6` (Sep 14–19), `goal = 25000`.** Six is correct — confirmed by
   Eswar 2026-09-04 after a member set it. Earlier notes saying five are superseded.
3. ~~Delete `feature/sponsors-page`~~ — **done 2026-09-03.** A copy of the original is
   archived outside the repo at `../reference/vamsi-original/`.
   **Caveat, verified not assumed:** deleting the branch did *not* remove the content.
   Commit `376945e` is still reachable by SHA and its raw file still returns HTTP 200
   unauthenticated, Interac answer included — GitHub keeps dangling objects. In practice
   this changes little: the answer is printed on the donor page for every donor by
   design, and the admin password guarded a page that no longer exists anywhere. Rotating
   the answer in Setup is the only action that actually changes the exposure.
5. **Merge the date-field fix from `claude/setup-page-tab-layout-mjk1b2`.** `.two` is
   still `1fr 1fr` here, so at 320px it resolves to 151px/98px — the date field hogs the
   row in Setup and in the new Tasks edit form. That branch's `minmax(0,1fr)` fixes all
   of them at once, which is exactly why the 2026-09-10 work did **not** patch `.two` on
   `main`: doing so would conflict with the branch. Then give the Tasks "Due" date its
   own wide column (see archive). Separately, at 320px the Sponsors filter row
   (Pending/Confirmed/Declined/All) spills ~16px off-screen; clean at 375px.
6. **Run `supabase/updates-2026-09-10.sql`**, then set the bank account name from Setup
   and flag the three admins (`update committee_members set is_admin = true where ...`).
   The file carries the SELECT to check first. Safe to run before deploying: the live
   build still reads `interac_answer`, which the migration leaves untouched.
7. Send the `#sponsor` link to the committee for a dry run before it reaches donors.

<!-- HANDOFF:ARCHIVE-BELOW -->

## Archive — 2026-09-10 detail

### What "admin" means here — deliberately narrow

Admin gates **`festival_config` and nothing else**: the festival name, dates, day count,
goal and payment details. Every member keeps full rights over the programme, tasks,
donations and sponsorships, and Setup's backup, public preview and sign-out stay open to
everyone. With ~10 volunteers running a five-day festival from their phones, gating
day-to-day work behind three people is a bottleneck, not safety.

Enforced in RLS (`festival_config admin write`), not just in the UI. `Setup.jsx` renders
its two settings cards as `disabled` fieldsets for a non-admin.

### `is_admin()` has a bootstrap clause, on purpose

While **no** member is flagged admin, every member counts as one — in SQL *and* in
`App.jsx`, which is why the screen and the database always agree. Without it, running the
migration before anyone is named locks the whole committee out of Setup. The corollary is
real: clearing the last admin re-opens Setup to everybody.

### Ordering rule (`bySponsorOrder`)

By festival day (general last) → unclaimed before claimed → dearest first →
open-amount items last → the order they were added. Applied once in the data layer so the
committee tab and the donor page cannot drift apart. Unit-checked, and idempotent.

### Verified (demo mode, seeded data, measured not assumed)

Edits round-trip and preserve `status`; a catalogue edit never touches
`status`/`sponsor_name`/`show_public`, so editing a claimed item cannot strand a
confirmed sponsorship. Deleting a declined request removes that row only. Day selection
lands on the right day before, during and after the festival, stops following once a day
is picked, and survives a re-pull and a focus event — `currentDayIndex` checked across
eight boundaries. A non-admin's Setup has both fieldsets disabled, all seven controls
unfocusable and no save buttons, with backup, preview and sign-out still working. No
horizontal overflow on any tab at 375px with the new forms open. `BASE_PATH` build still
rewrites asset URLs correctly. **+1.5 KB gzipped, no new dependencies.**

Run `vite --mode demo` with the Supabase vars blank to get this localStorage mode — it
is how the above was tested without writing to the live database.


## Archive — superseded 2026-09-10

## Current state

Vite + React 18 + Supabase. Six tabs: Overview, Schedule, Tasks, **Sponsors**, Team,
Setup. Bundle **120.6 KB gzipped** plus a 12.9 KB crest asset.

**Shipped 2026-09-03.** Schema run and verified, code merged to `main`, deployed to
Vercel, and confirmed working on the live site. Donors can sponsor at
`/#sponsor` right now.

Interac details are set in `festival_config` (`mtlganeshutsav@gmail.com`) and confirmed
rendering on the live donor form. **The security answer is the one that was already
published in Vamsi's `feature/sponsors-page` branch** — Eswar chose to keep it. It is now
rotatable from Setup with no redeploy, and deleting that branch would remove the copy
sitting in git history.

Added: `supabase/sponsorships.sql` (schema, RLS, three security-definer functions —
**run 2026-09-03**), `components/Sponsors.jsx` (committee: catalogue, queue, CSV),
`components/SponsorPublic.jsx` (donor page — full screen at `#sponsor`, embedded
elsewhere via `embedded`), `components/Crest.jsx` + `assets/mgu-crest.webp`.
Modified: `App.jsx`, `PublicDashboard.jsx`, `Overview.jsx`, `Garland.jsx`, `Setup.jsx`,
`lib/api.js`, `lib/constants.js`, `styles.css`.

### The data model

- **`sponsorship_items`** — the catalogue. Public read, committee write. `day_index`
  is 0-based to match `events.day`, `NULL` = general/any day. `amount` `0` = open
  amount. `status` is `available` | `pending` | `taken`.
- **`sponsorship_requests`** — donor name, email, phone. **Committee read only**, no
  anon policy, deliberately out of the realtime publication.
- **`submit_sponsorship()`** — the gate anonymous donors use instead of a direct
  insert. Validates name/email/amount server-side, refuses a claimed item.
- **`confirm_sponsorship()` / `decline_sponsorship()`** — committee only. Confirming
  writes a real `donations` row (+ `donation_private`); declining reverses it.

### Verified against the live database (2026-09-03)

Probed with the **anonymous** key over REST, with real rows present. All schema objects
confirmed by query. anon **can** read `sponsorship_items`; anon **cannot** read
`sponsorship_requests` — `[]` while a real request with name, email and phone existed,
**closing the long-standing gap where the probe had only ever run on empty tables**.
Direct anon `INSERT` → HTTP 401. `confirm`/`decline` → `not-allowed`. Double-booking →
`item-taken`. Validation → `bad-amount` (0 and negative), `bad-email`, `no-name`.
`donation_private`, `committee_members`, `invite_codes` all `[]` to anon.

Probe rows were removed afterwards; all sponsorship tables and `donations` are back to 0.

Front end: every donor-page colour passes WCAG AA against live computed styles, no
horizontal scroll at 320 or 375px, and `BASE_PATH=/mgu-committee-app/` rewrites the crest
URL correctly. Full demo-mode walkthrough in the archive.


## Archive — 2026-09-03 session detail

### Demo-mode walkthrough (superseded by the live-database verification above)

Catalogue CRUD · donor submit · double-booking refused · confirm → `donations` row →
Cash Raised and the public feed update · anonymous shows `Anonymous` with the real name
private · public page exposes no email or phone · decline reverses everything · CSV
export · amount rejected when empty/negative server-side · six tabs fit a 320px phone.

### Vamsi's two branches, reviewed

- **PR #1 `claude/setup-page-tab-layout-mjk1b2`** — date field overflowing on mobile
  Safari. **Real bug, correct fix.** Root cause measured: `1fr` = `minmax(auto,1fr)`,
  so the date input's 150.5px min-content pushed its column to 150.5/98.5 instead of
  even. Fix is `minmax(0,1fr)` + `min-width:0`. Verified no overflow at 375/320px,
  +0.11 KB gzipped. **Good to merge.** Two follow-ups: the date input in Tasks ("Due")
  sits in an even 152px column with ~1.5px of headroom and will likely clip on iOS
  Safari — silently, because `min-width:0` turns overflow into clipping — so it needs
  a mirrored wide-column variant (same for `Donations.jsx` if that tab returns); and
  `.two-date` only beats the ≤359px stacking rule by source order.
- **`feature/sponsors-page`** — a 1,328-line standalone `sponsors-ganesh.html` at the
  repo root. **Not merged.** Authored as a Claude Artifact: its whole data layer is
  `claude.use('db')`, which does not exist outside claude.ai (`ReferenceError: claude
  is not defined`, verified by serving it). Also a bare fragment with no
  doctype/charset/viewport, so it renders at 980px on a phone and shows mojibake; it
  hard-coded an admin password and an Interac security answer in a **public repo**;
  stored donor PII with no access control; and weighed 577 KB (400 KB gzipped)
  because the logo JPEG was embedded twice. **Its design and information architecture
  were kept** and rebuilt on React + Supabase.

### Overview and header rework (Vamsi's notes, same day)

- Header became **crest left, wordmark right**, description underneath. The
  description lives in `festival_config.description`, edited from Setup;
  `DEFAULT_DESCRIPTION` in `lib/constants.js` is only the fallback.
- Day selector shows **"Day 1", "Day 2"…** as pills instead of bare numbers, dates
  enlarged. The strip scrolls once days outrun the width; all stay reachable.
- **Cash raised became the sponsorship total**, from confirmed `sponsorship_requests`.
- **Removed:** In-kind gifts, Donors, the "Toward the goal" meter, and the whole
  **Donations tab**.

### Earlier sessions (2026-08-02/03)

Deployed to Vercel; GitHub Pages retired. Supabase schema run, RLS verified, env vars
wired, real festival details seeded. Self-serve joining shipped via invite codes and
the `join_committee()` security-definer function; email confirmation deliberately
disabled. Supabase auth Site URL and redirect allow-list configured — password reset
had never worked before that.
