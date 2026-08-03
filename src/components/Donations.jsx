import React, { useState } from 'react'
import { Plus, Trash2, Download, Coins, Package, Search, EyeOff } from 'lucide-react'
import { money, toCSV, download, todayLocal } from '../lib/format.js'
import { MONEY_CATS, GOODS_CATS, ANON } from '../lib/constants.js'

export default function Donations({ donations, addDonation, removeDonation, cash }) {
  const [kind, setKind] = useState('money')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const blank = {
    donor: '', amount: '', category: 'Interac', donated_on: todayLocal(),
    item: '', qty: '', receipt_no: '', note: '', anonymous: false,
  }
  const [f, setF] = useState(blank)

  const cats = kind === 'money' ? MONEY_CATS : GOODS_CATS

  const submit = async () => {
    if (!f.donor.trim()) return
    if (kind === 'money' && !f.amount) return
    if (kind === 'goods' && !f.item.trim()) return
    setBusy(true)
    const pub = {
      donor: f.anonymous ? ANON : f.donor.trim(),
      kind,
      category: cats.includes(f.category) ? f.category : cats[0],
      donated_on: f.donated_on,
      amount: kind === 'money' ? Number(f.amount) : null,
      item: kind === 'goods' ? f.item.trim() : null,
      qty: kind === 'goods' ? f.qty.trim() : null,
    }
    const priv = {
      real_name: f.anonymous ? f.donor.trim() : null,
      receipt_no: f.receipt_no.trim() || null,
      note: f.note.trim() || null,
    }
    try { await addDonation(pub, priv); setF({ ...blank, category: cats[0] }); setOpen(false) }
    finally { setBusy(false) }
  }

  const list = donations.filter((d) => d.kind === kind)
    .filter((d) => !q || ((d.donor || '') + ' ' + (d.real_name || '') + ' ' + (d.item || ''))
      .toLowerCase().includes(q.toLowerCase()))

  const exportCSV = () => {
    const rows = list.map((d) => ({ ...d, shown_as: d.donor, real_name: d.real_name || d.donor }))
    const cols = kind === 'money'
      ? ['donated_on', 'shown_as', 'real_name', 'amount', 'category', 'receipt_no', 'note']
      : ['donated_on', 'shown_as', 'real_name', 'item', 'qty', 'category', 'note']
    download(`mgu-${kind}-donations.csv`, toCSV(rows, cols))
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 18 }}>Donations</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn" onClick={exportCSV} aria-label="Export CSV"><Download size={15} /></button>
          <button className="btn btn-go" onClick={() => { setOpen(!open); setF({ ...blank, category: cats[0] }) }}>
            <Plus size={15} /> Record</button>
        </div>
      </div>

      <div className="banner" style={{ borderColor: 'var(--edge)', background: 'rgba(242,160,7,.08)' }}>
        Donor names and amounts appear on the <b>public page</b>. Receipt numbers and internal notes
        never do. Tick <b>keep this donor anonymous</b> and the public sees “{ANON}” instead.
      </div>

      <div className="seg">
        <button className={'btn' + (kind === 'money' ? ' btn-go' : '')}
          onClick={() => { setKind('money'); setF({ ...blank, category: MONEY_CATS[0] }) }}>
          <Coins size={15} /> Money</button>
        <button className={'btn' + (kind === 'goods' ? ' btn-go' : '')}
          onClick={() => { setKind('goods'); setF({ ...blank, category: GOODS_CATS[0] }) }}>
          <Package size={15} /> Food &amp; goods</button>
      </div>

      {open && (
        <div className="card" style={{ marginBottom: 10 }}>
          <label className="fld"><span>Donor</span>
            <input placeholder="Name or family" value={f.donor}
              onChange={(e) => setF({ ...f, donor: e.target.value })} /></label>

          <label className="check">
            <input type="checkbox" checked={f.anonymous}
              onChange={(e) => setF({ ...f, anonymous: e.target.checked })} />
            <EyeOff size={13} /> Keep this donor anonymous on the public page
          </label>

          {kind === 'money' ? (
            <div className="two">
              <label className="fld"><span>Amount (CAD)</span>
                <input type="number" inputMode="decimal" placeholder="101" value={f.amount}
                  onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
              <label className="fld"><span>Received by</span>
                <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                  {MONEY_CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
            </div>
          ) : (
            <>
              <div className="two">
                <label className="fld"><span>Item</span>
                  <input placeholder="Modak" value={f.item}
                    onChange={(e) => setF({ ...f, item: e.target.value })} /></label>
                <label className="fld"><span>Quantity</span>
                  <input placeholder="200 pcs" value={f.qty}
                    onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>
              </div>
              <label className="fld"><span>Category</span>
                <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                  {GOODS_CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
            </>
          )}

          <div className="two">
            <label className="fld"><span>Date</span>
              <input type="date" value={f.donated_on}
                onChange={(e) => setF({ ...f, donated_on: e.target.value })} /></label>
            <label className="fld"><span>Receipt no. <i className="priv">private</i></span>
              <input value={f.receipt_no}
                onChange={(e) => setF({ ...f, receipt_no: e.target.value })} /></label>
          </div>
          <label className="fld"><span>Internal note <i className="priv">private</i></span>
            <input placeholder="For Day 3 mahaprasad" value={f.note}
              onChange={(e) => setF({ ...f, note: e.target.value })} /></label>

          <button className="btn btn-go" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Record donation'}</button>
        </div>
      )}

      {kind === 'money' && (
        <div className="stat" style={{ marginBottom: 10 }}>
          <div className="stat-k">Total received</div><div className="stat-v num">{money(cash)}</div>
        </div>
      )}

      <label className="fld" style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
        <input placeholder="Search donors" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ paddingLeft: 30 }} />
      </label>

      <div className="card">
        {list.length === 0 ? (
          <div className="empty">
            {kind === 'money' ? 'No money recorded yet.' : 'No food or goods recorded yet.'}{' '}
            Record it the day it arrives — reconstructing later never works.
          </div>
        ) : list.map((d) => (
          <div className="item" key={d.id}>
            <div className="row">
              <div style={{ flex: 1 }}>
                <div className="item-t">
                  {d.donor === ANON && d.real_name
                    ? <>{d.real_name} <span className="chip" style={{ marginLeft: 4 }}>shown as {ANON}</span></>
                    : d.donor}
                </div>
                <div className="item-m">
                  {[d.category, d.donated_on, d.item, d.qty,
                    d.receipt_no ? `#${d.receipt_no}` : null].filter(Boolean).join(' · ')}
                </div>
                {d.note && <div className="item-m">{d.note}</div>}
              </div>
              {d.kind === 'money' && (
                <span className="num" style={{ fontSize: 14, color: 'var(--marigold)' }}>{money(d.amount)}</span>
              )}
              <button className="btn btn-ghost" aria-label="Remove"
                onClick={() => removeDonation(d.id)}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
