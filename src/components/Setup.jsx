import React, { useState, useEffect, useRef } from 'react'
import { Eye, LogOut, Lock } from 'lucide-react'
import { download, toCSV, todayLocal } from '../lib/format.js'

/**
 * `isAdmin` gates the two cards that change the festival for everybody — the
 * settings and the payment details. Everything else here (who sees what, the
 * public preview, the backup, sign out) stays open to every member, because a
 * volunteer locked out of sign-out is a support call at the mandap.
 */
export default function Setup({ cfg, saveConfig, counts, auth, demo, isAdmin,
                                onPreviewPublic, data }) {
  const [d, setD] = useState(cfg)
  const [saved, setSaved] = useState(false)

  /**
   * Keep the form in step with the stored config.
   *
   * Without this the form snapshots `cfg` once on mount and every Save writes
   * that snapshot back over all fields — so a member who left Setup open while
   * somebody else changed the dates would silently revert them on their next
   * save. Observed 2026-09-03: the festival length and goal were reset this way.
   *
   * Only re-syncs while the form is untouched, so a live update cannot wipe
   * what someone is halfway through typing.
   */
  const dirty = useRef(false)
  useEffect(() => { if (!dirty.current) setD(cfg) }, [cfg])
  const edit = (patch) => { dirty.current = true; setD((p) => ({ ...p, ...patch })) }

  const save = async () => {
    // Send only what this member actually changed, so saving one field cannot
    // roll back somebody else's edit to another.
    const next = {
      name: d.name, start_date: d.start_date,
      days: Number(d.days), goal: Number(d.goal),
      description: d.description || null,
      interac_email: d.interac_email || null,
      interac_name: d.interac_name || null,
      contact_email: d.contact_email || null,
    }
    const patch = {}
    for (const [k, v] of Object.entries(next)) {
      const was = k === 'days' || k === 'goal' ? Number(cfg[k]) : (cfg[k] ?? null)
      if (v !== was) patch[k] = v
    }
    await saveConfig(patch)
    dirty.current = false
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const backup = () => download(
    'mgu-backup-' + todayLocal() + '.json',
    JSON.stringify(data(), null, 2), 'application/json')

  return (
    <>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Setup</h2>

      {!isAdmin && (
        <div className="banner" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Lock size={15} style={{ flex: '0 0 auto', marginTop: 2 }} />
          <span>
            The festival settings and the payment details are looked after by the admins.
            You can read them here, and everything else on this page still works.
          </span>
        </div>
      )}

      <fieldset className="card plain-set" disabled={!isAdmin}>
        <label className="fld"><span>Festival name</span>
          <input value={d.name} onChange={(e) => edit({ name: e.target.value })} /></label>
        <div className="two">
          <label className="fld"><span>First day (sthapana)</span>
            <input type="date" value={d.start_date}
              onChange={(e) => edit({ start_date: e.target.value })} /></label>
          <label className="fld"><span>Number of days</span>
            <input type="number" min="1" max="11" value={d.days}
              onChange={(e) => edit({ days: e.target.value })} /></label>
        </div>
        <label className="fld"><span>Description — shown under the festival name</span>
          <textarea rows={2} value={d.description || ''}
            onChange={(e) => edit({ description: e.target.value })} /></label>
        <label className="fld"><span>Fundraising goal (CAD)</span>
          <input type="number" value={d.goal} onChange={(e) => edit({ goal: e.target.value })} /></label>
        {isAdmin && (
          <button className="btn btn-go" onClick={save}>{saved ? 'Saved' : 'Save settings'}</button>
        )}
      </fieldset>

      <fieldset className="card plain-set" disabled={!isAdmin}>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Sponsorship payment details</h3>
        <div className="item-m" style={{ marginBottom: 10 }}>
          Shown to donors on the sponsorship page when they choose Interac. Kept here rather
          than in the code because the app&apos;s source is public — change these and they take
          effect straight away, with no redeploy.
        </div>
        <label className="fld"><span>Interac e-Transfer email</span>
          <input type="email" inputMode="email" placeholder="mtlganeshutsav@gmail.com"
            value={d.interac_email || ''}
            onChange={(e) => edit({ interac_email: e.target.value })} /></label>
        <label className="fld"><span>Bank account name</span>
          <input placeholder="The name on the receiving account" value={d.interac_name || ''}
            onChange={(e) => edit({ interac_name: e.target.value })} /></label>
        <div className="item-m">
          The address is set up for auto-deposit, so donors are shown the account name to
          confirm who the money reaches — no security answer is asked for. Leave the email
          blank and the page simply tells donors a committee member will be in touch.
        </div>
        {isAdmin && (
          <button className="btn btn-go" style={{ marginTop: 10 }} onClick={save}>
            {saved ? 'Saved' : 'Save settings'}
          </button>
        )}
      </fieldset>

      <div className="card">
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Who sees what</h3>
        <div className="item-m">
          <b style={{ color: 'var(--marigold)' }}>Public</b> — anyone with the link, no sign-in:
          festival name and dates, the number of days, every event on each day, and the donor feed
          with names, amounts and categories. Nothing else.
        </div>
        <div className="item-m" style={{ marginTop: 8 }}>
          <b style={{ color: 'var(--marigold)' }}>Committee</b> — signed in: all of the above plus
          tasks, internal notes, receipt numbers, real names behind anonymous gifts, and phone numbers.
        </div>
        <button className="btn" style={{ marginTop: 10 }} onClick={onPreviewPublic}>
          <Eye size={14} /> Preview the public page
        </button>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Backup</h3>
        <div className="item-m" style={{ marginBottom: 8 }}>
          {counts.events} events · {counts.tasks} tasks · {counts.donations} donations · {counts.people} members
        </div>
        <button className="btn" onClick={backup}>Export everything as JSON</button>
        <div className="item-m" style={{ marginTop: 8 }}>
          Do this at the end of every festival day.
        </div>
      </div>

      {demo ? (
        <div className="banner">
          <b>Demo mode.</b> No backend is configured, so there is no sign-in and nothing is shared.
          Data lives in this browser only. See the README to connect Supabase.
        </div>
      ) : (
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Account</h3>
          <div className="item-m">Signed in as {auth.profile?.name || auth.user?.email}</div>
          <button className="btn" style={{ marginTop: 10 }} onClick={auth.signOut}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </>
  )
}
