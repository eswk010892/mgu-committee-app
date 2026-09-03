# Handoff — Committee Board

**Last session:** 2026-09-03 · sponsorships added, then Overview reworked to Vamsi's notes

> This repository is **public**. Credentials, the Supabase project ref, invite codes
> and payment details are deliberately kept out of it — they live in the database or
> in the maintainer's private notes. Please keep it that way.

---

## 1. What changed this session

Sponsorships were added as a first-class feature, replacing a standalone HTML
prototype that could not run outside the tool it was authored in.

### New

| File | What it is |
| --- | --- |
| `supabase/sponsorships.sql` | Schema, RLS and three security-definer functions. **Not yet run.** |
| `src/components/Sponsors.jsx` | Committee tab — catalogue, request queue, confirm/decline, CSV |
| `src/components/SponsorPublic.jsx` | Donor-facing page, reachable at `#sponsor`, no sign-in |
| `src/components/Crest.jsx` | The committee crest |
| `src/assets/mgu-crest.webp` | 192px alpha-masked WebP, 12.9 KB |

### Modified

`App.jsx` (Sponsors tab, `#sponsor` route, header crest), `PublicDashboard.jsx`
(crest + sponsorship call-to-action), `Setup.jsx` (payment-details panel),
`lib/api.js` (sponsorship data layer + demo adapters), `lib/constants.js`
(`SPONSOR_CATS`, `PAY_METHODS`), `styles.css` (crest, scoped donor-page theme,
tab bar tightened for seven tabs).

### Overview and header reworked (Vamsi's notes, same day)

- Header is now **crest on the left, wordmark on the right**, with a description
  underneath. The description lives in `festival_config.description` and is edited
  from Setup; `DEFAULT_DESCRIPTION` in `lib/constants.js` is only the fallback.
- Day selector shows **"Day 1", "Day 2"…** as pills instead of bare numbers, and the
  dates under them are larger. The strip scrolls horizontally once there are more days
  than fit — all of them stay reachable.
- **Cash raised is now the sponsorship total**, computed from confirmed
  `sponsorship_requests` — the same figure the Sponsors tab exports to CSV.
- **Removed:** In-kind gifts, Donors, the "Toward the goal" meter, and the whole
  **Donations tab**. `Donations.jsx` is still on disk but no longer imported or routed.

> **Assumption worth checking:** "Cash raised" counts **confirmed** requests only.
> Pending ones are promises and declined ones are not money, so neither is counted —
> even though the CSV export contains all three. If the intent was the total *pledged*,
> it is a one-line change in `Overview.jsx`.

### Data model

- **`sponsorship_items`** — the catalogue. Public read, committee write.
  `day_index` is 0-based to match `events.day`; `NULL` means "general / any day".
  `amount` of `0` means "open amount — donor names the figure".
  `status` is `available` | `pending` | `taken`.
- **`sponsorship_requests`** — donor name, email, phone. **Committee read only.**
  No anon policy at all, and deliberately left out of the realtime publication.
- **`submit_sponsorship()`** — the gate anonymous donors go through instead of a
  direct insert. Validates name, email and amount server-side and refuses an item
  that is already claimed. Same shape as the existing `join_committee()`.
- **`confirm_sponsorship()` / `decline_sponsorship()`** — committee only. Confirming
  writes a real `donations` row (plus `donation_private` for the real name), so
  sponsorship money counts toward the goal and appears in the public feed.
  Declining reverses all of it and frees the item.

---

## 2. Current state — what works

Verified end to end in demo mode, by measurement rather than inspection:

- Catalogue create / edit / delete, across days, categories, general and open-amount items
- Donor submission, including the general "any amount" path
- **Double-booking is refused.** Requesting an item flips it to `pending`, so it stops
  being offered rather than letting a second donor fill in the whole form first
- Confirm writes a `donations` row (category stays inside `MONEY_CATS`, dated with
  `todayLocal()` not UTC); Cash Raised on the Overview and the public donor feed both update
- Anonymous gifts show as `Anonymous` publicly with the real name in `donation_private`
- **The public page exposes no donor email or phone**
- Decline/undo removes the donation, the private row and frees the item
- CSV export of the request queue
- Amount is rejected when empty, zero or negative — in the database, not just the browser
- Every colour on the donor page passes WCAG AA against live computed styles
- No horizontal scroll at 375px or 320px; the six tabs fit a 320px phone
- `BASE_PATH=/mgu-committee-app/` rewrites the crest URL correctly

Bundle: **120.6 KB gzipped** (was 115.9) plus the crest as a separate 12.9 KB cached
asset — sponsorships added roughly 7 KB, removing the Donations tab gave ~1.7 KB back.

---

## 3. Known issues and gotchas

- **`supabase/sponsorships.sql` has not been run yet.** Nothing sponsorship-related
  exists in the database until it is. Confirm the project ref before running it.
- **Payment details are configuration, not code.** The Interac email and security
  answer live in `festival_config` and are edited from Setup. They are intentionally
  not in this repo — it is public. Leave the email blank and the donor page shows no
  payment details at all and simply says a committee member will be in touch.
  `festival_config` is public-read, which is correct: every donor has to be told the
  answer for a transfer to work. The account's protection is the inbox that receives
  the deposit link.
- **`sponsorship_items.status` has three values, not two.** Dropping `pending` back to
  a boolean reintroduces the double-booking hole.
- **`.sp-page` scopes the light palette on purpose.** The donor page is a trial of a
  lighter look while the rest of the app stays dark. If it is adopted, those tokens
  move to `:root`; until then the scoping is what stops it leaking.
- **The reduced-motion block at the end of `styles.css` must stay last.** Adding rules
  after it silently breaks the aarti freeze. It is currently the final rule.
- **Sponsorship amounts are validated in two places** — the `<input required>` and the
  SQL function. The database one is the real check; the browser one is a courtesy.
- **Open follow-up from PR #1:** the date input in Tasks ("Due") sits in an even 152px
  grid column with roughly 1.5px of headroom. On iOS Safari it is likely to clip — and
  because that fix adds `min-width:0`, it clips silently rather than visibly
  overflowing. It needs a mirrored wide-column variant. The same applies to
  `Donations.jsx` if that tab is ever restored.

---

## 4. Next steps

1. Run `supabase/sponsorships.sql` in the Supabase SQL editor. **Confirm the project
   ref first** — there is a same-named `events` table in an unrelated project.
2. Set the Interac email and security answer in **Setup → Sponsorship payment
   details**. Do not put them in the source.
3. Add the real sponsorship items with the committee — aartis, meals, decor, sound —
   with prices, plus a few open-amount entries.
4. Merge the date-field fix from `claude/setup-page-tab-layout-mjk1b2`, then address
   the Tasks/Donations date columns noted above.
5. Decide whether the lighter donor-page look should roll out to the whole app.
6. Send the `#sponsor` link to the committee for a dry run before it goes to donors.
