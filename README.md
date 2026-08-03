# Ganesh Utsav — Committee Board

A small, phone-first app for running a Ganesh Utsav: the day-by-day schedule, tasks with owners,
donations in both money and kind, and the committee roster.

Built for the **Montreal Ganesh Utsav Committee**, but nothing in it is Montreal-specific — change
the festival name, start date and day count in Setup and it runs any Ganeshotsav.

---

## What it does

| Tab | What it's for |
|---|---|
| **Overview** | Countdown to sthapana, cash raised against goal, open task count, today's programme, what's due next |
| **Schedule** | Per-day programme — aartis, cultural slots, mahaprasad — each with a time, place and named lead |
| **Tasks** | To do / doing / done, with owner, area and due date |
| **Donations** | Two registers: **money** (amount, method, receipt no.) and **food & goods** (item, quantity, category). CSV export for both |
| **Team** | Committee roster; names autocomplete into tasks and the schedule, and each shows their open task count |
| **Setup** | Festival dates, day count, fundraising goal, storage status, JSON backup and restore |

The row of beads under the header is the festival garland — one bead per day, tap to move between
them. The last day is marked in vermilion because that's visarjan.

---

## Quick start

```bash
git clone https://github.com/<your-org>/mgu-committee-app.git
cd mgu-committee-app
npm install
npm run dev
```

Open the URL it prints. With no keys configured it runs in **demo mode**: no sign-in, nothing
shared, data in your browser only. Good for a look around; connect Supabase below before you rely
on it.

---

---

## Two kinds of people

| | **Public** — anyone with the link | **Committee** — signed in |
|---|---|---|
| Festival name, dates, number of days | ✅ | ✅ |
| Every event on each day | ✅ | ✅ |
| Donor feed: name, amount, category | ✅ | ✅ |
| Live updates without refreshing | ✅ | ✅ |
| Real name behind an anonymous gift | ❌ | ✅ |
| Receipt numbers, internal notes | ❌ | ✅ |
| Tasks | ❌ | ✅ |
| Committee phone numbers | ❌ | ✅ |
| Editing anything | ❌ | ✅ |

There is **no public sign-up**. Accounts are created by an admin in Supabase, and a user only gets
edit rights once their id is added to `committee_members`. Somebody who signs up on their own and
is not on that list sees the public page and a note telling them to contact an admin.

All of this is enforced by Postgres row level security, not by the UI. The public reader is never
sent private rows, so there is nothing to uncover in the browser dev tools. This was verified
against a live Postgres: an anonymous role can read donations, events and config, gets zero rows
from `tasks`, `event_notes`, `donation_private` and `committee_members`, and every write attempt
is rejected.

### The donor-privacy decision, stated plainly

**Donor names and amounts are visible to the entire internet** — that is what you asked for and it
is how most mandals build trust. But not every donor expects it. Some give quietly and would be
upset to find their name and the sum on a public web page.

So every donation has a **keep this donor anonymous** tick box. When it is ticked the public sees
`Anonymous` and the amount; the real name is written to a separate committee-only table. Ask the
donor at the point of collection. It takes one second and it is the difference between a good
surprise and a bad one.

Never type an address, phone number or bank detail into the donor field — that field is public.

---

## Committee accounts

1. **Supabase → Authentication → Users → Add user.** Set an email and password, or send an invite.
2. Copy the new **User UID**.
3. **SQL Editor:**

   ```sql
   insert into committee_members (user_id, name, role, phone)
   values ('paste-uid-here', 'Vishal', 'Cricket lead', '+1 438-680-0166');
   ```

4. They can now sign in at the same URL via **Committee login**.

Revoking access is one line — `delete from committee_members where user_id = '...';` — and takes
effect on their next request. Deleting the auth user as well ends their session immediately.

---

## Tasks

Any committee member can add a task, assign it to anyone, reassign someone else's, and close it.
There is deliberately no owner-only lock: a volunteer board needs to pick up each other's work at
9pm without waiting for permission. Tap the owner line on any task to reassign it.

Tasks are never public.

---

## Connecting Supabase (required for real use)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), run it.
   It creates the tables, the row level security policies and the realtime publication. Re-running
   it is safe.
3. **Project Settings → API**: copy the Project URL and the publishable (`anon`) key.
4. Copy `.env.example` to `.env` and fill it in:

   ```env
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
   ```

   New Supabase projects issue a key that starts with `sb_publishable_`. Older ones issue a
   JWT starting with `eyJhbGci...`. Either works — `@supabase/supabase-js` has supported the
   newer format for a long time, and the version pinned in `package-lock.json` handles it.
   Whichever your project shows is the right one. Do **not** use the `service_role` key: it
   bypasses row level security entirely and would be shipped in the browser bundle.

5. Add yourself as a committee member (see below), then `npm run dev`.

The `anon` key is meant to be public and visible in the browser — it is not a password. What
protects your data is the row level security policy, which is why step 2 is not optional.

---

## Deploying

### Vercel (how the Montreal deployment runs)

Import the repo at vercel.com. Vite is auto-detected — build command `npm run build`, output
directory `dist`. Add two environment variables to Production, Preview and Development:

- `VITE_SUPABASE_URL` = your project URL
- `VITE_SUPABASE_ANON_KEY` = your anon key

Leave `BASE_PATH` unset; Vercel serves from the domain root and `vite.config.js` already falls
back to `base: '/'`. Every push to `main` redeploys.

> The anon key is a public, browser-visible key — it is not a password. It is kept out of the repo
> as a convenience, not as protection. Your actual protection is the RLS policy in `schema.sql`.

### GitHub Pages

Previously supported via `.github/workflows/deploy.yml`, now removed — running both meant two live
copies of the same commit on two public URLs. To bring it back, restore that workflow and set
**Settings → Pages → Source: GitHub Actions**. It needs `BASE_PATH=/<repo-name>/` because Pages
serves from a sub-path rather than the domain root.

### Add it to a phone home screen

Open the deployed site in Safari or Chrome → Share → *Add to Home Screen*. It opens full-screen and
behaves like an app. Tell the committee to do this on day one.

---

## Project structure

```
src/
├── App.jsx                 routing between public / login / committee, live refresh
├── styles.css              all styling (no framework)
├── lib/
│   ├── supabase.js         client; decides configured vs demo mode
│   ├── auth.js             session -> public | pending | committee
│   ├── api.js              every read and write, both adapters
│   ├── constants.js        defaults, donation and task categories
│   └── format.js           dates, currency, CSV, download
└── components/
    ├── PublicDashboard.jsx what anyone with the link sees
    ├── Login.jsx           committee sign-in
    ├── Garland.jsx         the day navigator
    ├── Overview.jsx        committee dashboard
    ├── Schedule.jsx        per-day programme + private notes
    ├── Tasks.jsx           tasks, assignment, status
    ├── Donations.jsx       money + goods, anonymous option
    ├── Team.jsx            roster (read only)
    └── Setup.jsx           config, who-sees-what, public preview, backup
```

## Data model

| Table | Who can read | Contents |
|---|---|---|
| `festival_config` | public | name, start date, day count, goal |
| `events` | public | day, time, title, place, lead |
| `donations` | public | display name, kind, category, amount or item, date |
| `event_notes` | committee | internal remarks on an event |
| `donation_private` | committee | real name if anonymous, receipt no., note |
| `tasks` | committee | title, area, owner, due date, status |
| `committee_members` | committee | who may sign in, plus role and phone |

Private data lives in **separate tables**, not hidden columns. Postgres row level security works
per row, so a private column on a public table would still be readable by the public API and could
leak through realtime. Splitting the tables makes the boundary absolute.

## Backup

Setup → **Export JSON** downloads the whole board. Do this at the end of every festival day. It is
the only thing between you and re-typing the donation register.

## Roadmap

- [ ] Per-day budget vs. actual
- [ ] Public sponsor wall
- [ ] Volunteer shift assignment with clash detection
- [ ] Sponsor tiers and logo management
- [ ] Printable donation receipts
- [ ] French UI

## Contributing

Pull requests welcome. Keep it dependency-light — the whole point is that a volunteer can open this
on a bad phone signal at the mandap and it loads instantly.

## Licence

MIT — see [LICENSE](LICENSE).
