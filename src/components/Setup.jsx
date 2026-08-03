import React, { useState } from 'react'
import { Eye, LogOut } from 'lucide-react'
import { download, toCSV, todayLocal } from '../lib/format.js'

export default function Setup({ cfg, saveConfig, counts, auth, demo, onPreviewPublic, data }) {
  const [d, setD] = useState(cfg)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    await saveConfig({ name: d.name, start_date: d.start_date, days: Number(d.days), goal: Number(d.goal) })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const backup = () => download(
    'mgu-backup-' + todayLocal() + '.json',
    JSON.stringify(data(), null, 2), 'application/json')

  return (
    <>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Setup</h2>

      <div className="card">
        <label className="fld"><span>Festival name</span>
          <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
        <div className="two">
          <label className="fld"><span>First day (sthapana)</span>
            <input type="date" value={d.start_date}
              onChange={(e) => setD({ ...d, start_date: e.target.value })} /></label>
          <label className="fld"><span>Number of days</span>
            <input type="number" min="1" max="11" value={d.days}
              onChange={(e) => setD({ ...d, days: e.target.value })} /></label>
        </div>
        <label className="fld"><span>Fundraising goal (CAD)</span>
          <input type="number" value={d.goal} onChange={(e) => setD({ ...d, goal: e.target.value })} /></label>
        <button className="btn btn-go" onClick={save}>{saved ? 'Saved' : 'Save settings'}</button>
      </div>

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
