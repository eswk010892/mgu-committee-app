import React, { useState } from 'react'
import { Coins, Package, Radio, Calendar, HandHeart } from 'lucide-react'
import { dayDate, fmtDay, money, timeAgo } from '../lib/format.js'
import { DEVA, DEFAULT_DESCRIPTION } from '../lib/constants.js'
import GaneshMark from './GaneshMark.jsx'
import Crest from './Crest.jsx'
import Garland from './Garland.jsx'
import SponsorPublic from './SponsorPublic.jsx'

/**
 * What anyone with the link sees. Read only, live.
 * Receives only data the database allows the public to read.
 *
 * Two tabs rather than one long scroll: the programme reuses the committee's
 * day selector so a visitor picks a day instead of scrolling past all of them,
 * and Donate carries the real sponsorship page rather than a link to it.
 */
export default function PublicDashboard({ cfg, events, donations, sponsorItems = [],
                                          submitSponsorship, onLogin }) {
  const nDays = Math.max(1, Math.min(11, Number(cfg.days) || 1))
  const [tab, setTab] = useState('schedule')      // schedule | donate
  const [day, setDay] = useState(0)

  const daysLeft = Math.ceil((new Date(cfg.start_date + 'T12:00:00') - new Date()) / 86400000)

  const dayEvents = events.filter((e) => e.day === day)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

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

      <nav className="pubtabs" aria-label="Sections">
        <button className="pubtab" data-on={tab === 'schedule' ? '1' : '0'}
          onClick={() => setTab('schedule')}>
          <Calendar size={19} strokeWidth={2.2} /> Schedule
        </button>
        <button className="pubtab" data-on={tab === 'donate' ? '1' : '0'}
          onClick={() => setTab('donate')}>
          <HandHeart size={19} strokeWidth={2.2} /> Donate
        </button>
      </nav>

      {tab === 'schedule' ? (
        <>
          <Garland cfg={cfg} day={day} setDay={setDay} events={events} />

          <div className="card">
            <div className="row" style={{ marginBottom: dayEvents.length ? 6 : 0 }}>
              <h3 style={{ fontSize: 15 }}>
                Day {day + 1} <span className="deva" style={{ color: 'var(--marigold)' }}>{DEVA[day] || ''}</span>
              </h3>
              <span className="item-m" style={{ margin: 0 }}>{fmtDay(dayDate(cfg, day))}</span>
            </div>
            {dayEvents.length === 0
              ? <div className="empty">Programme for this day to be announced.</div>
              : <div className="pub-day-list">{dayEvents.map((e) => (
                <div className="pub-ev" key={e.id}>
                  <span className="pub-ev-time">{e.start_time || '—'}</span>
                  <div className="pub-ev-body">
                    <div className="pub-ev-title">{e.title}</div>
                    {e.place && <div className="pub-ev-place">{e.place}</div>}
                  </div>
                </div>
              ))}</div>}
          </div>
        </>
      ) : (
        <div className="donate-cols">
          <SponsorPublic embedded cfg={cfg} items={sponsorItems} submit={submitSponsorship} />

          <div className="donate-feed">
          <h2 style={{ fontSize: 18, margin: '0 0 4px' }}>Our donors</h2>
          <div className="item-m" style={{ marginBottom: 10 }}>
            Thank you to everyone supporting this year&apos;s Ganeshotsav.
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
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', margin: '26px 0 10px' }}>
        <button className="btn" onClick={onLogin}>Committee login</button>
      </div>
    </div>
  )
}
