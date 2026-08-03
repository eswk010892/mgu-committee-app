import React, { useState } from 'react'
import { Plus, Trash2, UserPlus } from 'lucide-react'
import { TASK_CATS } from '../lib/constants.js'

/**
 * Any committee member may add a task, reassign it to anyone, or close it.
 * There is no owner-only lock — a volunteer board needs to be able to pick up
 * each other's work without asking permission.
 */
export default function Tasks({ tasks, people, me, addTask, updateTask, removeTask }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('open')
  const [assigning, setAssigning] = useState(null)
  const blank = { title: '', category: 'Other', owner: '', due_date: '' }
  const [f, setF] = useState(blank)

  const submit = async () => {
    if (!f.title.trim()) return
    await addTask({
      title: f.title.trim(), category: f.category,
      owner: f.owner.trim() || null, due_date: f.due_date || null,
      status: 'todo', created_by: me || null,
    })
    setF(blank); setOpen(false)
  }

  const cycle = (t) => updateTask(t.id, {
    status: t.status === 'todo' ? 'doing' : t.status === 'doing' ? 'done' : 'todo',
  })

  const list = tasks
    .filter((t) => filter === 'open' ? t.status !== 'done'
                 : filter === 'mine' ? t.owner === me && t.status !== 'done'
                 : filter === 'done' ? t.status === 'done' : true)
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))

  const names = people.map((p) => p.name).filter(Boolean)

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 18 }}>Tasks</h2>
        <button className="btn btn-go" onClick={() => setOpen(!open)}><Plus size={15} /> Add</button>
      </div>

      <div className="item-m" style={{ marginBottom: 10 }}>
        Committee only — tasks are never shown on the public page.
      </div>

      {open && (
        <div className="card" style={{ marginBottom: 10 }}>
          <label className="fld"><span>Task</span>
            <input placeholder="Confirm idol pickup" value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <div className="two">
            <label className="fld"><span>Area</span>
              <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {TASK_CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="fld"><span>Due</span>
              <input type="date" value={f.due_date}
                onChange={(e) => setF({ ...f, due_date: e.target.value })} /></label>
          </div>
          <label className="fld"><span>Assign to</span>
            <select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
              <option value="">Unassigned</option>
              {names.map((n) => <option key={n}>{n}</option>)}
            </select></label>
          <button className="btn btn-go" onClick={submit}>Add task</button>
        </div>
      )}

      <div className="seg">
        {[['open', 'Open'], ['mine', 'Mine'], ['done', 'Done'], ['all', 'All']].map(([k, l]) => (
          <button key={k} className={'btn' + (filter === k ? ' btn-go' : '')}
            onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty">
            {filter === 'mine' ? 'Nothing assigned to you.'
              : 'Nothing here. Start with permits, idol and venue — those have the longest lead times.'}
          </div>
        ) : list.map((t) => (
          <div className="item" key={t.id}>
            <div className="row">
              <button className="btn btn-ghost" onClick={() => cycle(t)}
                aria-label="Change status" style={{ paddingLeft: 0 }}>
                <span className={'chip ' + (t.status === 'done' ? 'chip-done' : t.status === 'doing' ? 'chip-on' : '')}>
                  {t.status === 'done' ? 'Done' : t.status === 'doing' ? 'Doing' : 'To do'}
                </span>
              </button>
              <div style={{ flex: 1 }}>
                <div className="item-t" style={{
                  textDecoration: t.status === 'done' ? 'line-through' : 'none',
                  opacity: t.status === 'done' ? 0.55 : 1 }}>{t.title}</div>
                {assigning === t.id ? (
                  <select autoFocus value={t.owner || ''} style={{ marginTop: 6 }}
                    onChange={(e) => { updateTask(t.id, { owner: e.target.value || null }); setAssigning(null) }}
                    onBlur={() => setAssigning(null)}>
                    <option value="">Unassigned</option>
                    {names.map((n) => <option key={n}>{n}</option>)}
                  </select>
                ) : (
                  <button className="link" onClick={() => setAssigning(t.id)}>
                    <UserPlus size={11} /> {t.owner || 'Unassigned'} · {t.category}
                    {t.due_date ? ` · due ${t.due_date}` : ''}
                  </button>
                )}
              </div>
              <button className="btn btn-ghost" aria-label="Remove"
                onClick={() => removeTask(t.id)}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
