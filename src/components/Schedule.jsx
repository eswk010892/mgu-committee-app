import React, { useState } from 'react'
import { Plus, Trash2, Globe } from 'lucide-react'
import { dayDate, fmtDay } from '../lib/format.js'

export default function Schedule({ cfg, day, events, notes, addEvent, removeEvent, people }) {
  const [open, setOpen] = useState(false)
  const blank = { start_time: '', title: '', place: '', lead: '' }
  const [f, setF] = useState(blank)
  const [note, setNote] = useState('')

  const list = events.filter((e) => e.day === day)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

  const submit = async () => {
    if (!f.title.trim()) return
    await addEvent({
      day, start_time: f.start_time || null, title: f.title.trim(),
      place: f.place.trim() || null, lead: f.lead.trim() || null,
    }, note.trim() || null)
    setF(blank); setNote(''); setOpen(false)
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 18 }}>Day {day + 1} · {fmtDay(dayDate(cfg, day))}</h2>
        <button className="btn btn-go" onClick={() => setOpen(!open)}><Plus size={15} /> Add</button>
      </div>

      <div className="item-m" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Globe size={12} /> The programme is public. Internal notes stay with the committee.
      </div>

      {open && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="two">
            <label className="fld"><span>Time</span>
              <input type="time" value={f.start_time}
                onChange={(e) => setF({ ...f, start_time: e.target.value })} /></label>
            <label className="fld"><span>Lead</span>
              <select value={f.lead} onChange={(e) => setF({ ...f, lead: e.target.value })}>
                <option value="">Unassigned</option>
                {people.map((p) => <option key={p.id}>{p.name}</option>)}
              </select></label>
          </div>
          <label className="fld"><span>What&apos;s happening</span>
            <input placeholder="Evening aarti" value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="fld"><span>Where</span>
            <input placeholder="Main hall" value={f.place}
              onChange={(e) => setF({ ...f, place: e.target.value })} /></label>
          <label className="fld"><span>Internal note <i className="priv">private</i></span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <button className="btn btn-go" onClick={submit}>Save to Day {day + 1}</button>
        </div>
      )}

      <div className="card">
        {list.length === 0 ? (
          <div className="empty">Day {day + 1} is empty. Add the aarti timings and the day&apos;s cultural slot.</div>
        ) : list.map((e) => (
          <div className="item" key={e.id}>
            <div className="row">
              <div style={{ flex: 1 }}>
                <div className="row" style={{ justifyContent: 'flex-start', gap: 9 }}>
                  <span className="num" style={{ fontSize: 13, color: 'var(--marigold)' }}>
                    {e.start_time || '—:—'}</span>
                  <span className="item-t">{e.title}</span>
                </div>
                <div className="item-m">
                  {[e.place, e.lead ? `Lead: ${e.lead}` : null].filter(Boolean).join(' · ') || 'No location or lead set'}
                </div>
                {notes[e.id] && <div className="item-m"><i className="priv">private</i> {notes[e.id]}</div>}
              </div>
              <button className="btn btn-ghost" aria-label="Remove"
                onClick={() => removeEvent(e.id)}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
