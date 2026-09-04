import React, { useState, useMemo } from 'react'
import { Plus, Trash2, Check, Undo2, Download, ExternalLink, Mail, Phone,
         ClipboardList, Eye } from 'lucide-react'

import { dayDate, fmtDay, money, timeAgo, toCSV, download, todayLocal } from '../lib/format.js'
import { SPONSOR_CATS } from '../lib/constants.js'
import SponsorPublic from './SponsorPublic.jsx'

/**
 * Committee side of sponsorships: keep the catalogue, work the request queue.
 *
 * Confirming a request is a database call, not a UI state change — it creates
 * the donation row so the money lands in the goal and the public feed, and
 * marks the catalogue item taken. Declining reverses all of it.
 */
export default function Sponsors({ cfg, items, requests, day,
                                   addItem, updateItem, removeItem,
                                   confirmRequest, declineRequest,
                                   submitSponsorship, onOpenPublic }) {
  const nDays = Math.max(1, Math.min(11, Number(cfg.days) || 1))
  const [view, setView] = useState('manage')      // manage | donor
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('pending')
  const [busy, setBusy] = useState(null)

  const blank = { day_index: day, category: SPONSOR_CATS[0], title: '', amount: '', note: '' }
  const [f, setF] = useState(blank)

  const pending = requests.filter((r) => r.status === 'pending')
  const confirmed = requests.filter((r) => r.status === 'confirmed')

  const raised = useMemo(
    () => confirmed.reduce((s, r) => s + Number(r.amount || 0), 0), [confirmed])
  const promised = useMemo(
    () => pending.reduce((s, r) => s + Number(r.amount || 0), 0), [pending])

  const shown = requests.filter((r) => (filter === 'all' ? true : r.status === filter))

  const submitItem = async () => {
    if (!f.title.trim()) return
    await addItem({
      day_index: f.day_index === 'general' ? null : Number(f.day_index),
      category: f.category.trim() || 'General',
      title: f.title.trim(),
      amount: Number(f.amount) || 0,
      note: f.note.trim() || null,
      sort_order: Date.now() % 100000,
    })
    setF({ ...blank, day_index: f.day_index, category: f.category })
  }

  const act = async (fn, id) => { setBusy(id); try { await fn(id) } finally { setBusy(null) } }

  const exportCSV = () => download(
    'mgu-sponsorships-' + todayLocal() + '.csv',
    toCSV(requests.map((r) => ({
      Name: r.donor_name, Organisation: r.org || '', Email: r.email, Phone: r.phone || '',
      Item: r.item_label || '', Day: r.item_day == null ? 'General' : 'Day ' + (r.item_day + 1),
      Amount: r.amount, Pay: r.pay_method, Public: r.show_name ? 'Yes' : 'Anonymous',
      Message: r.message || '', Status: r.status, Received: r.created_at,
    })), ['Name', 'Organisation', 'Email', 'Phone', 'Item', 'Day', 'Amount', 'Pay',
         'Public', 'Message', 'Status', 'Received']))

  const dayLabel = (i) => (i == null ? 'General' : `Day ${i + 1} · ${fmtDay(dayDate(cfg, i))}`)

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 18 }}>Sponsorships</h2>
        <button className="btn" onClick={onOpenPublic} title="Open full screen, as a donor sees it">
          <ExternalLink size={14} /> Open
        </button>
      </div>

      {/* Manage the list, or look at exactly what a donor sees — without leaving the tab. */}
      <div className="seg">
        <button className="btn" onClick={() => setView('manage')}
          style={view === 'manage' ? { borderColor: 'var(--marigold)', color: 'var(--marigold)' } : null}>
          <ClipboardList size={14} /> Manage
        </button>
        <button className="btn" onClick={() => setView('donor')}
          style={view === 'donor' ? { borderColor: 'var(--marigold)', color: 'var(--marigold)' } : null}>
          <Eye size={14} /> Donor view
        </button>
      </div>

      {view === 'donor' ? (
        <SponsorPublic embedded cfg={cfg} items={items} submit={submitSponsorship} />
      ) : (
      <>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
        <div className="stat">
          <div className="stat-k">Confirmed</div>
          <div className="stat-v num">{money(raised)}</div>
        </div>
        <div className="stat">
          <div className="stat-k">Awaiting confirmation</div>
          <div className="stat-v num">{money(promised)}</div>
        </div>
      </div>

      {/* ------------------------------------------------------ the queue -- */}
      <div className="row" style={{ margin: '22px 0 8px' }}>
        <h3 style={{ fontSize: 15 }}>
          Requests {pending.length > 0 && <span className="chip chip-on">{pending.length} new</span>}
        </h3>
        {requests.length > 0 && (
          <button className="btn" onClick={exportCSV}><Download size={14} /> CSV</button>
        )}
      </div>

      <div className="seg">
        {[['pending', 'Pending'], ['confirmed', 'Confirmed'], ['declined', 'Declined'], ['all', 'All']]
          .map(([id, label]) => (
            <button key={id} className="btn" data-on={filter === id ? '1' : '0'}
              style={filter === id ? { borderColor: 'var(--marigold)', color: 'var(--marigold)' } : null}
              onClick={() => setFilter(id)}>{label}</button>
          ))}
      </div>

      <div className="card">
        {shown.length === 0 ? (
          <div className="empty">
            {filter === 'pending' ? 'No requests waiting. ' : 'Nothing here. '}
            Sponsorship requests from the donor page land in this queue.
          </div>
        ) : shown.map((r) => (
          <div className="item" key={r.id}>
            <div className="row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item-t">
                  {r.donor_name}{r.org ? ` · ${r.org}` : ''}
                  {!r.show_name && <i className="priv">anonymous</i>}
                </div>
                <div className="item-m">
                  {r.item_label} · {dayLabel(r.item_day)} · {r.pay_method}
                  {r.created_at ? ` · ${timeAgo(r.created_at)}` : ''}
                </div>
                <div className="item-m" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <a className="link" href={`mailto:${r.email}`}><Mail size={11} /> {r.email}</a>
                  {r.phone && <a className="link" href={`tel:${r.phone}`}><Phone size={11} /> {r.phone}</a>}
                </div>
                {r.message && <div className="item-m" style={{ fontStyle: 'italic' }}>“{r.message}”</div>}
              </div>
              <span className="num" style={{ fontSize: 15, color: 'var(--marigold)' }}>
                {money(r.amount)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {r.status !== 'confirmed' ? (
                <button className="btn btn-go" disabled={busy === r.id}
                  onClick={() => act(confirmRequest, r.id)}>
                  <Check size={13} /> {busy === r.id ? 'Working…' : 'Confirm & record donation'}
                </button>
              ) : (
                <span className="chip chip-done">Confirmed · in the donor feed</span>
              )}
              {r.status !== 'declined' && (
                <button className="btn" disabled={busy === r.id}
                  onClick={() => act(declineRequest, r.id)}>
                  <Undo2 size={13} /> {r.status === 'confirmed' ? 'Undo' : 'Decline'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* -------------------------------------------------- the catalogue -- */}
      <div className="row" style={{ margin: '22px 0 8px' }}>
        <h3 style={{ fontSize: 15 }}>What can be sponsored ({items.length})</h3>
        <button className="btn" onClick={() => setOpen(!open)}>
          <Plus size={14} /> {open ? 'Close' : 'Add'}
        </button>
      </div>

      {open && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="two">
            <label className="fld"><span>Day</span>
              <select value={f.day_index}
                onChange={(e) => setF({ ...f, day_index: e.target.value === 'general' ? 'general' : Number(e.target.value) })}>
                {Array.from({ length: nDays }, (_, i) => (
                  <option key={i} value={i}>Day {i + 1} · {fmtDay(dayDate(cfg, i))}</option>
                ))}
                <option value="general">General · any day</option>
              </select></label>
            <label className="fld"><span>Category</span>
              <input list="sp-cats" value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value })} />
              <datalist id="sp-cats">
                {SPONSOR_CATS.map((c) => <option key={c} value={c} />)}
              </datalist></label>
          </div>
          <label className="fld"><span>What is being sponsored</span>
            <input placeholder="Day 1 mahaprasad" value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <div className="two">
            <label className="fld"><span>Amount (CAD) — 0 for open</span>
              <input type="number" inputMode="decimal" min="0" placeholder="500" value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
            <label className="fld"><span>Note (optional)</span>
              <input placeholder="Feeds 60 guests" value={f.note}
                onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          </div>
          <button className="btn btn-go" onClick={submitItem}>Add to the list</button>
        </div>
      )}

      <div className="card">
        {items.length === 0 ? (
          <div className="empty">
            Nothing listed yet. Add what the committee needs covered — an aarti, a meal,
            the sound system — and donors can claim it from the donor page.
          </div>
        ) : items.map((it) => (
          <div className="item" key={it.id}>
            <div className="row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item-t">{it.title}</div>
                <div className="item-m">
                  {dayLabel(it.day_index)} · {it.category}
                  {it.note ? ` · ${it.note}` : ''}
                </div>
                {it.sponsor_name && (
                  <div className="item-m">
                    Sponsored by {it.sponsor_name}
                    {it.show_public === false && <i className="priv">hidden</i>}
                  </div>
                )}
              </div>
              <span className="num" style={{ fontSize: 14, color: 'var(--marigold)' }}>
                {Number(it.amount) > 0 ? money(it.amount) : 'Open'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={'chip ' + (it.status === 'taken' ? 'chip-done' : 'chip-on')}>
                {it.status === 'taken' ? 'Taken'
                  : it.status === 'pending' ? 'Requested — not confirmed'
                  : 'Available'}
              </span>
              {it.sponsor_name && (
                <label className="check" style={{ margin: 0 }}>
                  <input type="checkbox" checked={it.show_public !== false}
                    onChange={(e) => updateItem(it.id, { show_public: e.target.checked })} />
                  Show the name publicly
                </label>
              )}
              <button className="btn-ghost" title="Remove" style={{ marginLeft: 'auto' }}
                onClick={() => removeItem(it.id)}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </>
  )
}
