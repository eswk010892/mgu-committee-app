import React from 'react'
import { dayDate, fmtDay, money } from '../lib/format.js'

export default function Overview({ cfg, cash, goods, openTasks, tasks, events, day, donations }) {
  const pct = Math.min(100, (cash / Math.max(1, Number(cfg.goal))) * 100)
  const today = events.filter((e) => e.day === day)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  const soon = tasks.filter((t) => t.status !== 'done' && t.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 4)

  return (
    <>
      <div className="stat-grid">
        <div className="stat"><div className="stat-k">Cash raised</div><div className="stat-v num">{money(cash)}</div></div>
        <div className="stat"><div className="stat-k">In-kind gifts</div><div className="stat-v num">{goods}</div></div>
        <div className="stat"><div className="stat-k">Tasks open</div><div className="stat-v num">{openTasks}</div></div>
        <div className="stat"><div className="stat-k">Donors</div>
          <div className="stat-v num">{new Set(donations.map((d) => d.donor)).size}</div></div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="row">
          <h3 style={{ fontSize: 15 }}>Toward the goal</h3>
          <span className="num" style={{ fontSize: 13, color: 'var(--marigold)' }}>
            {money(cash)} / {money(cfg.goal)}</span>
        </div>
        <div className="meter"><i style={{ width: pct + '%' }} /></div>
        <div className="item-m" style={{ marginTop: 8 }}>
          {cash >= cfg.goal ? 'Goal met — anything further goes to the annadanam fund.'
            : `${money(Math.max(0, cfg.goal - cash))} still to raise.`}
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Day {day + 1} · {fmtDay(dayDate(cfg, day))}</h3>
        {today.length === 0 ? (
          <div className="empty">Nothing scheduled yet. Add the day&apos;s aartis first.</div>
        ) : today.map((e) => (
          <div className="item" key={e.id}>
            <div className="row">
              <div><div className="item-t">{e.title}</div>
                <div className="item-m">{e.lead ? `Lead: ${e.lead}` : 'No lead assigned'}
                  {e.place ? ` · ${e.place}` : ''}</div></div>
              <span className="num" style={{ fontSize: 13, color: 'var(--marigold)' }}>{e.start_time || '—'}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Due next</h3>
        {soon.length === 0 ? (
          <div className="empty">No dated tasks. Add due dates so things stop landing on the last week.</div>
        ) : soon.map((t) => (
          <div className="item" key={t.id}>
            <div className="row">
              <div><div className="item-t">{t.title}</div>
                <div className="item-m">{t.owner || 'Unassigned'} · {t.category}</div></div>
              <span className="num" style={{ fontSize: 12, color: 'var(--muted)' }}>{t.due_date}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
