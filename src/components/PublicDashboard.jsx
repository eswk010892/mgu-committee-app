import React, { useMemo } from 'react'
import { Coins, Package, Radio, HandHeart } from 'lucide-react'
import { dayDate, fmtDay, money, timeAgo } from '../lib/format.js'
import { DEVA, DEFAULT_DESCRIPTION } from '../lib/constants.js'
import GaneshMark from './GaneshMark.jsx'
import Crest from './Crest.jsx'

/**
 * What anyone with the link sees. Read only, live.
 * Receives only data the database allows the public to read.
 */
export default function PublicDashboard({ cfg, events, donations, sponsorItems = [], onSponsor, onLogin }) {
  const nDays = Math.max(1, Math.min(11, Number(cfg.days) || 1))

  const cash = useMemo(
    () => donations.filter((d) => d.kind === 'money').reduce((s, d) => s + Number(d.amount || 0), 0),
    [donations])
  const goods = donations.filter((d) => d.kind === 'goods').length
  const donors = new Set(donations.map((d) => d.donor)).size

  const daysLeft = Math.ceil((new Date(cfg.start_date + 'T12:00:00') - new Date()) / 86400000)

  return (
    <div className="mgu-shell" style={{ paddingBottom: 40 }}>
      <header className="mgu-top has-mark">
        <div className="mgu-id">
          <Crest size={76} className="mgu-id-crest" />
          <div className="mgu-id-text">
            <div className="mgu-eyebrow deva">श्री गणेशाय नमः</div>
            <h1 className="mgu-title">{cfg.name}</h1>
            <div className="mgu-sub">
              {daysLeft > 0
                ? `Begins in ${daysLeft} day${daysLeft === 1 ? '' : 's'} · ${fmtDay(dayDate(cfg, 0))}`
                : daysLeft === 0 ? 'Sthapana is today' : 'Festival underway'}
              {' · '}{nDays} days of celebration
            </div>
          </div>
        </div>
        <p className="mgu-desc">{cfg.description || DEFAULT_DESCRIPTION}</p>
        <GaneshMark size={124} className="mark-watermark" />
      </header>

      <div className="live"><Radio size={13} /> Live — this page updates by itself</div>

      {onSponsor && (
        <div className="card sponsor-cta">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="item-t">Sponsor a part of the festival</div>
            <div className="item-m">
              {sponsorItems.some((i) => i.status !== 'taken')
                ? `${sponsorItems.filter((i) => i.status !== 'taken').length} still available — an aarti, a meal, the decorations.`
                : 'Give any amount toward this year’s celebration.'}
            </div>
          </div>
          <button className="btn btn-go" onClick={onSponsor}>
            <HandHeart size={14} /> Sponsor
          </button>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat"><div className="stat-k">Days</div><div className="stat-v num">{nDays}</div></div>
        <div className="stat"><div className="stat-k">Events</div><div className="stat-v num">{events.length}</div></div>
        <div className="stat"><div className="stat-k">Contributions</div><div className="stat-v num">{donations.length}</div></div>
        <div className="stat"><div className="stat-k">Donors</div><div className="stat-v num">{donors}</div></div>
      </div>

      <h2 style={{ fontSize: 18, margin: '22px 0 10px' }}>Programme</h2>
      {Array.from({ length: nDays }, (_, i) => {
        const list = events.filter((e) => e.day === i)
          .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
        return (
          <div className="card" key={i}>
            <div className="row" style={{ marginBottom: list.length ? 6 : 0 }}>
              <h3 style={{ fontSize: 15 }}>
                Day {i + 1} <span className="deva" style={{ color: 'var(--marigold)' }}>{DEVA[i] || ''}</span>
              </h3>
              <span className="item-m" style={{ margin: 0 }}>{fmtDay(dayDate(cfg, i))}</span>
            </div>
            {list.length === 0
              ? <div className="item-m">Programme to be announced.</div>
              : list.map((e) => (
                <div className="item" key={e.id}>
                  <div className="row">
                    <div style={{ flex: 1 }}>
                      <div className="item-t">{e.title}</div>
                      {e.place && <div className="item-m">{e.place}</div>}
                    </div>
                    <span className="num" style={{ fontSize: 13, color: 'var(--marigold)' }}>
                      {e.start_time || '—'}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )
      })}

      <h2 style={{ fontSize: 18, margin: '22px 0 4px' }}>Our donors</h2>
      <div className="item-m" style={{ marginBottom: 10 }}>
        Thank you to everyone supporting this year&apos;s Ganeshotsav.
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="stat"><div className="stat-k">Received</div><div className="stat-v num">{money(cash)}</div></div>
        <div className="stat"><div className="stat-k">Food &amp; goods</div><div className="stat-v num">{goods}</div></div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        {donations.length === 0 ? (
          <div className="empty">No contributions recorded yet.</div>
        ) : donations.map((d) => (
          <div className="item" key={d.id}>
            <div className="row">
              <div style={{ flex: 1 }}>
                <div className="item-t">{d.donor}</div>
                <div className="item-m" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {d.kind === 'money' ? <Coins size={12} /> : <Package size={12} />}
                  <span className="chip chip-on">{d.category}</span>
                  {d.kind === 'goods' && d.item ? <span>{d.item}{d.qty ? ` · ${d.qty}` : ''}</span> : null}
                  {d.created_at ? <span>· {timeAgo(d.created_at)}</span> : null}
                </div>
              </div>
              {d.kind === 'money' && (
                <span className="num" style={{ fontSize: 15, color: 'var(--marigold)' }}>{money(d.amount)}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', margin: '26px 0 10px' }}>
        <button className="btn" onClick={onLogin}>Committee login</button>
      </div>
    </div>
  )
}
