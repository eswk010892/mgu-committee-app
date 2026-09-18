import React, { useState, useMemo } from 'react'
import { Check, X, Loader2, ArrowLeft } from 'lucide-react'

import { dayDate, fmtDay, money } from '../lib/format.js'
import { PAY_METHODS } from '../lib/constants.js'
import Crest from './Crest.jsx'

const GENERAL = '__general__'

/** The first tab: everything still unclaimed, across every day. */
const OPEN = 'open'

/** Suggested contributions to a pot. Only the ones that still fit are offered. */
const CHIP_INS = [51, 101, 251, 501]

/** What is still needed in a pot. Infinity for a pot with no target. */
const potLeft = (it) => (Number(it.amount) > 0
  ? Math.max(0, Number(it.amount) - Number(it.raised || 0)) : Infinity)

/** Reasons the database can refuse a submission, in words a donor understands. */
const REASONS = {
  'item-taken': 'Someone just claimed this one. Pick another item, or make a general sponsorship.',
  'bad-amount': 'Please enter an amount greater than zero.',
  'bad-email': 'That email address does not look right.',
  'no-name': 'Please tell us your name.',
  'no-pay-method': 'Please choose how you would like to pay.',
  'no-phone': 'Please give a phone number — the committee calls to confirm every sponsorship.',
  'no-such-item': 'That item is no longer listed.',
  'over-pot': 'That is more than this pot still needs. Please lower the amount.',
  error: 'Something went wrong. Please try again.',
}

/**
 * The page a donor sees. Reads the catalogue (public) and writes through
 * api.submitSponsorship, which is a database gate — the amount and the item's
 * availability are validated server side, not here.
 *
 * Styling is scoped under `.sp-page` so this light treatment cannot leak into
 * the dark committee board while the committee decides whether they like it.
 */
export default function SponsorPublic({ cfg, items, submit, onBack, embedded = false }) {
  const nDays = Math.max(1, Math.min(11, Number(cfg.days) || 1))
  // Opens on everything still unclaimed, so a donor sees what the committee
  // needs without paging through days. The day tabs are still there to browse.
  const [day, setDay] = useState(OPEN)
  const chooseDay = setDay
  const [open, setOpen] = useState(null)      // item object, or GENERAL, or null
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(null)      // the submitted form, once accepted
  const [err, setErr] = useState('')

  const blank = { name: '', org: '', email: '', phone: '', amount: '',
                  payMethod: PAY_METHODS[0].value, showName: true, message: '' }
  const [f, setF] = useState(blank)

  const isGeneral = open === GENERAL
  const item = isGeneral ? null : open
  // Payment details come from festival_config, so nothing is committed to the
  // repo and the committee can change them from Setup without a deploy.
  // The account name is shown instead of a security answer: the address is set
  // up for auto-deposit, so there is no question to answer — what a donor needs
  // is confirmation of who the money is going to before they send it.
  const interac = cfg.interac_email
    ? { email: cfg.interac_email, name: cfg.interac_name }
    : null
  // A priced item is sponsored at its listed price; an open-amount item (0) and
  // a general sponsorship both ask the donor for a figure.
  // A pot always asks: the donor chooses their share of it.
  const needsAmount = isGeneral || (item && (item.pooled || Number(item.amount) <= 0))
  // Follow the live catalogue, so the modal's "left" figure drops while it is
  // open if somebody else chips in first.
  const livePot = item?.pooled ? (items.find((i) => i.id === item.id) || item) : null
  const left = livePot ? potLeft(livePot) : Infinity

  // Unclaimed: still offered, and for a pot, not yet full.
  const unclaimed = useMemo(
    () => items.filter((i) => i.status === 'available' && (!i.pooled || potLeft(i) > 0)),
    [items])

  const dayItems = useMemo(() => {
    if (day === OPEN) {
      // Last day first, counting down, then the any-day items. The sort is
      // stable, so each day keeps the `bySponsorOrder` order items arrive in.
      const rank = (i) => (i.day_index == null ? -1 : i.day_index)
      return [...unclaimed].sort((a, b) => rank(b) - rank(a))
    }
    return items.filter((i) => (day === 'general' ? i.day_index == null : i.day_index === day))
  }, [items, unclaimed, day])

  const byCategory = useMemo(() => {
    const g = {}
    // The unclaimed list spans days, so it is grouped by day, not category.
    const key = (i) => (day !== OPEN ? i.category || 'General'
      : i.day_index == null ? 'Any day'
      : `Day ${i.day_index + 1} · ${fmtDay(dayDate(cfg, i.day_index))}`)
    dayItems.forEach((i) => { (g[key(i)] ||= []).push(i) })
    // No sort here: groups keep the order of their first item, and items arrive
    // sorted by `bySponsorOrder`, so a group with anything still open comes first.
    return Object.entries(g)
  }, [dayItems])

  const openFor = (target) => { setF(blank); setErr(''); setDone(null); setOpen(target) }
  const close = () => { setOpen(null); setErr(''); setDone(null) }

  const send = async (e) => {
    e.preventDefault()
    setErr(''); setSending(true)
    const res = await submit({
      itemId: item ? item.id : null,
      name: f.name, org: f.org, email: f.email, phone: f.phone,
      amount: needsAmount ? f.amount : null,
      payMethod: f.payMethod, showName: f.showName, message: f.message,
      day: isGeneral ? (day === 'general' || day === OPEN ? null : day) : null,
    })
    setSending(false)
    if (res === 'ok') setDone({ ...f, label: item ? item.title : 'General sponsorship', pot: !!livePot })
    else if (res === 'over-pot' && Number.isFinite(left))
      setErr(`Only ${money(left)} is left in this pot. Please lower the amount.`)
    else if (res === 'item-taken' && livePot)
      setErr('This pot has just been fully sponsored. Thank you for thinking of it.')
    else setErr(REASONS[res] || REASONS.error)
  }

  return (
    <div className={'sp-page' + (embedded ? ' sp-embed' : '')}>
      {!embedded && (
        <header className="sp-top">
          <button className="sp-back" onClick={onBack}><ArrowLeft size={15} /> Back</button>
          <div className="sp-brand"><Crest size={30} /> Montreal Ganesh Utsav</div>
        </header>
      )}

      <section className="sp-hero">
        <Crest size={embedded ? 68 : 104} className="sp-hero-crest" />
        <p className="sp-eyebrow">Sponsorships · {cfg.name}</p>
        <h1 className="sp-title">Support <em>Ganesh Utsav</em></h1>
        <p className="sp-dates">
          {fmtDay(dayDate(cfg, 0))} — {fmtDay(dayDate(cfg, nDays - 1))}, {dayDate(cfg, 0).getFullYear()}
        </p>
        <p className="sp-lede">
          Sponsor an aarti, a meal, or the decorations — or give any amount toward the festival.
          Every contribution keeps this celebration going for hundreds of families in Montreal.
        </p>
        <button className="sp-cta" onClick={() => openFor(GENERAL)}>Make a sponsorship</button>
      </section>

      <nav className="sp-tabs" aria-label="Festival day">
        <button className="sp-tab" data-on={day === OPEN ? '1' : '0'} onClick={() => chooseDay(OPEN)}>
          Available<span>{unclaimed.length} open</span>
        </button>
        {Array.from({ length: nDays }, (_, i) => (
          <button key={i} className="sp-tab" data-on={day === i ? '1' : '0'} onClick={() => chooseDay(i)}>
            Day {i + 1}<span>{fmtDay(dayDate(cfg, i)).replace(/^\w+,\s*/, '')}</span>
          </button>
        ))}
        <button className="sp-tab" data-on={day === 'general' ? '1' : '0'} onClick={() => chooseDay('general')}>
          General<span>any day</span>
        </button>
      </nav>

      <section className="sp-items">
        {byCategory.length === 0 ? (
          <div className="sp-empty">
            <Crest size={54} />
            {day === OPEN ? (
              <>
                <h3>Everything has been sponsored</h3>
                <p>Thank you, Montreal. You can still give any amount toward the festival.</p>
              </>
            ) : (
              <>
                <h3>Nothing listed here yet</h3>
                <p>The committee is still adding sponsorship options for this day.
                  You can still give any amount toward the festival.</p>
              </>
            )}
            <button className="sp-cta sp-cta-sm" onClick={() => openFor(GENERAL)}>
              {day === OPEN ? 'Make a sponsorship' : 'Sponsor this day'}</button>
          </div>
        ) : byCategory.map(([cat, list]) => (
          <div key={cat} className="sp-cat">
            <h3 className="sp-cat-label">{cat}</h3>
            {list.map((it) => {
              if (it.pooled) {
                const target = Number(it.amount) > 0
                const rest = potLeft(it)
                const full = target && rest <= 0
                return (
                  <div key={it.id} className={'sp-row sp-pot' + (full ? ' is-taken' : '')}>
                    <div className="sp-row-main">
                      <div className="sp-row-name">{it.title}</div>
                      {it.note && <div className="sp-row-note">{it.note}</div>}
                    </div>
                    <div className="sp-row-amt">
                      {full ? money(it.amount) : target ? money(rest) : money(it.raised || 0)}
                      <small>{full || !target ? 'pledged' : 'to go'}</small>
                    </div>
                    {target && (
                      <div className="sp-pot-meter">
                        {/* The bar is what is still needed, so it drains as people give. */}
                        <div className="sp-pot-bar" role="progressbar" aria-label={`${it.title}: still needed`}
                          aria-valuemin={0} aria-valuemax={Number(it.amount)} aria-valuenow={rest}>
                          <i style={{ width: (rest / Number(it.amount)) * 100 + '%' }} />
                        </div>
                        <div className="sp-pot-meta">
                          {Number(it.raised) > 0
                            ? `${money(it.raised)} of ${money(it.amount)} pledged`
                              + ` · ${it.backers} ${it.backers === 1 ? 'contributor' : 'contributors'}`
                            : `Be the first to chip in toward ${money(it.amount)}`}
                        </div>
                      </div>
                    )}
                    <div className={'sp-pill ' + (full ? 'sp-pill-taken' : 'sp-pill-open')}>
                      {full ? 'Fully sponsored · thank you' : 'Chip in any amount'}
                    </div>
                    {!full && (
                      <button className="sp-row-btn" onClick={() => openFor(it)}>Chip in</button>
                    )}
                  </div>
                )
              }
              // 'pending' means somebody has asked for it and the committee has
              // not confirmed yet. It stops being offered either way, so two
              // donors cannot fill in the form for the same thing.
              const free = it.status === 'available'
              const taken = it.status === 'taken'
              return (
                <div key={it.id} className={'sp-row' + (free ? '' : ' is-taken')}>
                  <div className="sp-row-main">
                    <div className="sp-row-name">{it.title}</div>
                    {it.note && <div className="sp-row-note">{it.note}</div>}
                  </div>
                  <div className="sp-row-amt">
                    {Number(it.amount) > 0 ? money(it.amount) : 'Any amount'}
                  </div>
                  <div className={'sp-pill ' + (free ? 'sp-pill-open' : 'sp-pill-taken')}>
                    {taken
                      ? (it.sponsor_name && it.show_public !== false
                          ? `Sponsored by ${it.sponsor_name}` : 'Sponsored')
                      : free ? 'Available' : 'Spoken for'}
                  </div>
                  {free && (
                    <button className="sp-row-btn" onClick={() => openFor(it)}>Sponsor</button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </section>

      <p className="sp-foot">
        {embedded
          ? 'This is exactly what a donor sees at the #sponsor link.'
          : 'Questions? Speak to any committee member. Amounts shown are in Canadian dollars.'}
      </p>

      {open && (
        <>
          <div className="sp-overlay" onClick={close} />
          <div className="sp-modal" role="dialog" aria-modal="true" aria-label="Sponsorship form">
            <div className="sp-modal-top">
              <h2>{done ? 'Thank you' : livePot ? 'Chip in' : item ? 'Confirm your sponsorship' : 'Make a sponsorship'}</h2>
              <button className="sp-x" onClick={close} aria-label="Close"><X size={18} /></button>
            </div>

            {done ? (
              <div className="sp-thanks">
                <div className="sp-tick"><Check size={26} strokeWidth={3} /></div>
                <p className="sp-thanks-lede">
                  {done.pot
                    ? <>We have your <b>{money(done.amount)}</b> toward <b>{done.label}</b>.</>
                    : <>We have your request for <b>{done.label}</b>.</>}
                </p>
                {interac && done.payMethod === 'Interac' ? (
                  <>
                    <p className="sp-thanks-body">
                      Next step — send your e-Transfer. Please send it <b>now that the form is
                      in</b>, so we can match your payment to your name.
                    </p>
                    <div className="sp-interac">
                      <div className="sp-interac-row">
                        <span>Interac e-Transfer to</span><b>{interac.email}</b>
                      </div>
                      {interac.name && (
                        <div className="sp-interac-row">
                          <span>Account name</span><b className="sp-acct">{interac.name}</b>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="sp-thanks-body">
                    A committee member will contact <b>{done.email}</b> to arrange
                    payment and confirm your sponsorship. Nothing is due until then.
                  </p>
                )}
                <button className="sp-cta sp-cta-sm" onClick={close}>Done</button>
              </div>
            ) : (
              <form className="sp-form" onSubmit={send}>
                {item && (
                  <div className="sp-chosen">
                    <span>{item.title}</span>
                    <b>{livePot
                      ? (Number.isFinite(left) ? `${money(left)} to go` : 'Any amount')
                      : Number(item.amount) > 0 ? money(item.amount) : 'Any amount'}</b>
                  </div>
                )}

                <label className="sp-f"><span>Your name <i>*</i></span>
                  <input required value={f.name} autoComplete="name"
                    onChange={(e) => setF({ ...f, name: e.target.value })} /></label>

                <label className="sp-f"><span>Temple / company (optional)</span>
                  <input value={f.org} autoComplete="organization"
                    onChange={(e) => setF({ ...f, org: e.target.value })} /></label>

                <div className="sp-two">
                  <label className="sp-f"><span>Email <i>*</i></span>
                    <input required type="email" inputMode="email" autoComplete="email"
                      value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
                  <label className="sp-f"><span>Phone <i>*</i></span>
                    <input required type="tel" inputMode="tel" autoComplete="tel"
                      value={f.phone} placeholder="+1 514…"
                      onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
                </div>

                {needsAmount && (
                  <label className="sp-f"><span>{livePot ? 'Your share in CAD' : 'Amount in CAD'} <i>*</i></span>
                    <input required type="number" inputMode="decimal" min="1" step="1"
                      max={Number.isFinite(left) ? left : undefined}
                      placeholder="101" value={f.amount}
                      onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
                )}
                {livePot && (
                  <div className="sp-chips">
                    {CHIP_INS.filter((n) => n < left).map((n) => (
                      <button type="button" key={n} className="sp-chip"
                        data-on={Number(f.amount) === n ? '1' : '0'}
                        onClick={() => setF({ ...f, amount: String(n) })}>${n}</button>
                    ))}
                    {Number.isFinite(left) && left > 0 && (
                      <button type="button" className="sp-chip"
                        data-on={Number(f.amount) === left ? '1' : '0'}
                        onClick={() => setF({ ...f, amount: String(left) })}>
                        All ${left.toLocaleString('en-CA')}</button>
                    )}
                  </div>
                )}

                <fieldset className="sp-f sp-pay">
                  <span>How will you pay? <i>*</i></span>
                  <div className="sp-pay-grid">
                    {PAY_METHODS.map((p) => (
                      <label key={p.value} className="sp-radio" data-on={f.payMethod === p.value ? '1' : '0'}>
                        <input type="radio" name="sp-pay" value={p.value} required
                          checked={f.payMethod === p.value}
                          onChange={() => setF({ ...f, payMethod: p.value })} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="sp-f"><span>Message to the committee (optional)</span>
                  <textarea rows={2} value={f.message}
                    onChange={(e) => setF({ ...f, message: e.target.value })} /></label>

                <label className="sp-check">
                  <input type="checkbox" checked={f.showName}
                    onChange={(e) => setF({ ...f, showName: e.target.checked })} />
                  Show my name publicly. Untick to be listed as Anonymous.
                </label>

                {interac && f.payMethod === 'Interac' && (
                  <div className="sp-interac sp-interac-hint">
                    <div className="sp-interac-title">How to send your e-Transfer</div>
                    <div className="sp-interac-row">
                      <span>Send to</span><b>{interac.email}</b>
                    </div>
                    {interac.name && (
                      <div className="sp-interac-row">
                        <span>Account name</span><b className="sp-acct">{interac.name}</b>
                      </div>
                    )}
                    <p className="sp-interac-note">
                      Send the transfer <b>after</b> submitting this form, so we can match
                      the payment to your name.
                    </p>
                  </div>
                )}

                {err && <p className="sp-err" role="alert">{err}</p>}

                <button className="sp-submit" type="submit" disabled={sending}>
                  {sending ? <><Loader2 size={15} className="sp-spin" /> Sending…</>
                    : livePot ? 'Submit my contribution' : 'Submit sponsorship'}
                </button>
                <p className="sp-fineprint">
                  No payment is taken on this page. The committee will contact you to arrange it.
                </p>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  )
}
