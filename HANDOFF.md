# Handoff — Committee Board

**Last session:** 2026-09-03 · sponsorships built; Overview reworked

> This repository is **public**. Credentials, the Supabase project ref, invite codes
> and payment details are deliberately kept out of it — they live in the database or
> in the maintainer's private notes. Please keep it that way.

## Current state

Vite + React 18 + Supabase. Six tabs: Overview, Schedule, Tasks, **Sponsors**, Team,
Setup. Bundle **120.6 KB gzipped** plus a 12.9 KB crest asset.

**Sponsorships are built and verified, but not deployed.** All of it is uncommitted
work in the tree, and `supabase/sponsorships.sql` has **not been run** yet — nothing
sponsorship-related exists in the database until it is.

| File | What it is |
| --- | --- |
| `supabase/sponsorships.sql` | Schema, RLS, three security-definer functions. **Not yet run.** |
| `src/components/Sponsors.jsx` | Committee: catalogue, request queue, confirm/decline, CSV |
| `src/components/SponsorPublic.jsx` | Donor page at `#sponsor`, no sign-in |
| `src/components/Crest.jsx` + `src/assets/mgu-crest.webp` | The committee crest |

Modified: `App.jsx`, `PublicDashboard.jsx`, `Overview.jsx`, `Garland.jsx`,
`Setup.jsx`, `lib/api.js`, `lib/constants.js`, `styles.css`.

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

### Verified working (measured, in demo mode)

Catalogue CRUD · donor submit · **double-booking refused** · confirm → `donations`
row → Cash Raised and the public feed update · anonymous shows `Anonymous` with the
real name private · **public page exposes no email or phone** · decline reverses
everything · CSV export · amount rejected when empty/negative server-side · every
donor-page colour passes WCAG AA against live computed styles · no horizontal scroll
at 375 or 320px · `BASE_PATH=/mgu-committee-app/` rewrites the crest URL correctly.

## Gotchas — things that look wrong but are correct

- **Payment details are configuration, not code.** Interac email and answer live in
  `festival_config`, edited from Setup. Not in this repo — it is public. Blank email
  ⇒ the donor page shows no payment details at all. `festival_config` is public-read,
  which is right: every donor must be told the answer for a transfer to work; the
  account's protection is the inbox receiving the deposit link.
- **`sponsorship_items.status` has three values.** Dropping `pending` back to a
  boolean reintroduces the double-booking hole.
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

1. Run `supabase/sponsorships.sql` in the Supabase SQL editor. **Confirm the project
   ref first** — an unrelated project has a same-named `events` table, and because the
   script uses `create table if not exists`, running it there would skip creation and
   apply a public-read policy to that table instead.
2. Set the Interac email and answer in **Setup → Sponsorship payment details**.
   Change the answer if the one from the prototype is real — it has been sitting in a
   public repo.
3. Commit and push the feature work (only `HANDOFF.md` is committed so far).
4. Add the real sponsorship items with the committee.
5. Merge the date-field fix from `claude/setup-page-tab-layout-mjk1b2`, then give the
   Tasks "Due" date its own wide column (see archive).
6. Send the `#sponsor` link to the committee for a dry run before it reaches donors.

<!-- HANDOFF:ARCHIVE-BELOW -->

## Archive — 2026-09-03 session detail

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
