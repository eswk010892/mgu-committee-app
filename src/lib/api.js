/**
 * Data access.
 *
 * Two adapters behind one interface:
 *   supabase — the real thing. Auth + row level security decide who sees what.
 *   demo     — localStorage, no auth, everything unlocked. Used only when no
 *              Supabase keys are present, so `npm run dev` works on a fresh clone.
 *
 * PUBLIC vs COMMITTEE is enforced in the database, not here. The public reader
 * is not sent private rows at all — hiding them in the UI would not be security.
 */
import { supabase, isConfigured } from './supabase.js'
import { DEFAULT_CFG, ANON } from './constants.js'
import { uid, todayLocal } from './format.js'

/* ------------------------------------------------------------------ demo -- */

const LS = 'mgu:demo'
const blank = { cfg: DEFAULT_CFG, events: [], notes: {}, donations: [], priv: {}, tasks: [], people: [],
                sponsorItems: [], sponsorRequests: [] }
const readDemo = () => {
  try { return { ...blank, ...JSON.parse(localStorage.getItem(LS) || '{}') } }
  catch { return { ...blank } }
}
const writeDemo = (d) => {
  localStorage.setItem(LS, JSON.stringify(d))
  window.dispatchEvent(new Event('mgu:demo-change'))
}

/* --------------------------------------------------------------- reading -- */

export async function getConfig() {
  if (!isConfigured) return readDemo().cfg
  const { data, error } = await supabase.from('festival_config').select('*').eq('id', 1).maybeSingle()
  if (error) { console.error(error); return DEFAULT_CFG }
  return data || DEFAULT_CFG
}

export async function getEvents() {
  if (!isConfigured) return readDemo().events
  const { data, error } = await supabase.from('events').select('*').order('start_time')
  if (error) { console.error(error); return [] }
  return data || []
}

/** Public-safe donation feed. Committee members get the private half merged in. */
export async function getDonations(committee = false) {
  if (!isConfigured) {
    const d = readDemo()
    return d.donations.map((x) => (committee ? { ...x, ...(d.priv[x.id] || {}) } : x))
  }
  const { data, error } = await supabase.from('donations').select('*').order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  if (!committee) return data || []
  const { data: priv } = await supabase.from('donation_private').select('*')
  const map = Object.fromEntries((priv || []).map((p) => [p.donation_id, p]))
  return (data || []).map((d) => ({ ...d, ...(map[d.id] || {}) }))
}

export async function getTasks() {
  if (!isConfigured) return readDemo().tasks
  const { data, error } = await supabase.from('tasks').select('*').order('due_date', { nullsFirst: false })
  if (error) { console.error(error); return [] }
  return data || []
}

export async function getPeople() {
  if (!isConfigured) return readDemo().people
  const { data, error } = await supabase.from('committee_members').select('*').order('name')
  if (error) { console.error(error); return [] }
  return (data || []).map((p) => ({ ...p, id: p.user_id }))
}

export async function getEventNotes() {
  if (!isConfigured) return readDemo().notes
  const { data, error } = await supabase.from('event_notes').select('*')
  if (error) return {}
  return Object.fromEntries((data || []).map((n) => [n.event_id, n.notes]))
}

/* --------------------------------------------------------------- writing -- */

export async function saveConfig(cfg) {
  if (!isConfigured) { const d = readDemo(); d.cfg = cfg; writeDemo(d); return }
  const { error } = await supabase.from('festival_config')
    .upsert({ id: 1, ...cfg, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function addEvent(ev, notes) {
  if (!isConfigured) {
    const d = readDemo(); const id = uid()
    d.events.push({ ...ev, id }); if (notes) d.notes[id] = notes
    writeDemo(d); return
  }
  const { data, error } = await supabase.from('events').insert(ev).select().single()
  if (error) throw error
  if (notes) await supabase.from('event_notes').upsert({ event_id: data.id, notes })
}

export async function removeEvent(id) {
  if (!isConfigured) {
    const d = readDemo(); d.events = d.events.filter((e) => e.id !== id)
    delete d.notes[id]; writeDemo(d); return
  }
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}

/**
 * `pub` is what the world sees. `priv` never leaves the committee.
 * For an anonymous gift, pub.donor is the word "Anonymous" and the real
 * name is stored in priv.real_name.
 */
export async function addDonation(pub, priv) {
  if (!isConfigured) {
    const d = readDemo(); const id = uid()
    d.donations.unshift({ ...pub, id, created_at: new Date().toISOString() })
    if (priv && Object.values(priv).some(Boolean)) d.priv[id] = priv
    writeDemo(d); return
  }
  const { data, error } = await supabase.from('donations').insert(pub).select().single()
  if (error) throw error
  if (priv && Object.values(priv).some(Boolean)) {
    const { error: e2 } = await supabase.from('donation_private')
      .upsert({ donation_id: data.id, ...priv })
    if (e2) console.error(e2)
  }
}

export async function removeDonation(id) {
  if (!isConfigured) {
    const d = readDemo(); d.donations = d.donations.filter((x) => x.id !== id)
    delete d.priv[id]; writeDemo(d); return
  }
  const { error } = await supabase.from('donations').delete().eq('id', id)
  if (error) throw error
}

export async function addTask(t) {
  if (!isConfigured) { const d = readDemo(); d.tasks.push({ ...t, id: uid() }); writeDemo(d); return }
  const { error } = await supabase.from('tasks').insert(t)
  if (error) throw error
}

export async function updateTask(id, patch) {
  if (!isConfigured) {
    const d = readDemo()
    d.tasks = d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t))
    writeDemo(d); return
  }
  const { error } = await supabase.from('tasks').update(patch).eq('id', id)
  if (error) throw error
}

export async function removeTask(id) {
  if (!isConfigured) { const d = readDemo(); d.tasks = d.tasks.filter((t) => t.id !== id); writeDemo(d); return }
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

/* ---------------------------------------------------------- sponsorships -- */

/** The catalogue. Public — this is what donors browse. */
export async function getSponsorItems() {
  if (!isConfigured) return readDemo().sponsorItems
  const { data, error } = await supabase.from('sponsorship_items')
    .select('*').order('day_index', { nullsFirst: false }).order('sort_order')
  if (error) { console.error(error); return [] }
  return data || []
}

/** Requests carry donor email and phone. RLS returns nothing to a non-member. */
export async function getSponsorRequests() {
  if (!isConfigured) return readDemo().sponsorRequests
  const { data, error } = await supabase.from('sponsorship_requests')
    .select('*').order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return data || []
}

export async function addSponsorItem(item) {
  if (!isConfigured) {
    const d = readDemo()
    d.sponsorItems.push({ ...item, id: uid(), status: 'available', sponsor_name: null,
                          created_at: new Date().toISOString() })
    writeDemo(d); return
  }
  const { error } = await supabase.from('sponsorship_items').insert(item)
  if (error) throw error
}

export async function updateSponsorItem(id, patch) {
  if (!isConfigured) {
    const d = readDemo()
    d.sponsorItems = d.sponsorItems.map((i) => (i.id === id ? { ...i, ...patch } : i))
    writeDemo(d); return
  }
  const { error } = await supabase.from('sponsorship_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function removeSponsorItem(id) {
  if (!isConfigured) {
    const d = readDemo()
    d.sponsorItems = d.sponsorItems.filter((i) => i.id !== id)
    d.sponsorRequests = d.sponsorRequests.map((r) => (r.item_id === id ? { ...r, item_id: null } : r))
    writeDemo(d); return
  }
  const { error } = await supabase.from('sponsorship_items').delete().eq('id', id)
  if (error) throw error
}

/**
 * Public submission. Goes through the security-definer gate rather than a
 * direct insert, so the amount and the item's availability are checked in the
 * database — the browser is not trusted with either.
 * Resolves to a short status string: 'ok' | 'item-taken' | 'bad-amount' | …
 */
export async function submitSponsorship(f) {
  if (!isConfigured) {
    const d = readDemo()
    const item = f.itemId ? d.sponsorItems.find((i) => i.id === f.itemId) : null
    if (f.itemId && !item) return 'no-such-item'
    if (item && item.status !== 'available') return 'item-taken'
    if (item && d.sponsorRequests.some((r) => r.item_id === item.id && r.status !== 'declined'))
      return 'item-taken'
    const amount = item && Number(item.amount) > 0 ? Number(item.amount) : Number(f.amount)
    if (!amount || amount <= 0) return 'bad-amount'
    if (!f.name?.trim()) return 'no-name'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email || '')) return 'bad-email'
    if (!f.phone || f.phone.trim().length < 7) return 'no-phone'
    if (!f.payMethod) return 'no-pay-method'
    d.sponsorRequests.unshift({
      id: uid(), item_id: f.itemId || null,
      item_label: item ? item.title : 'General sponsorship',
      item_day: item ? item.day_index : (f.day ?? null),
      kind: item ? 'item' : 'general',
      donor_name: f.name.trim(), org: f.org?.trim() || null,
      email: f.email.trim().toLowerCase(), phone: f.phone.trim(),
      amount, pay_method: f.payMethod, show_name: f.showName !== false,
      message: f.message?.trim() || null, status: 'pending', donation_id: null,
      created_at: new Date().toISOString(),
    })
    if (item) d.sponsorItems = d.sponsorItems.map((i) =>
      (i.id === item.id ? { ...i, status: 'pending' } : i))
    writeDemo(d); return 'ok'
  }
  const { data, error } = await supabase.rpc('submit_sponsorship', {
    p_item_id: f.itemId || null,
    p_donor_name: f.name,
    p_email: f.email,
    p_amount: f.amount ? Number(f.amount) : null,
    p_pay_method: f.payMethod,
    p_org: f.org || null,
    p_phone: f.phone || null,
    p_message: f.message || null,
    p_show_name: f.showName !== false,
    p_day: f.day ?? null,
  })
  if (error) { console.error(error); return 'error' }
  return data
}

/** Committee: accept a request. Creates the matching donation row. */
export async function confirmSponsorship(id) {
  if (!isConfigured) {
    const d = readDemo()
    const r = d.sponsorRequests.find((x) => x.id === id)
    if (!r || r.status === 'confirmed') return 'already-confirmed'
    const pub = r.show_name ? (r.org || r.donor_name) : ANON
    const did = uid()
    d.donations.unshift({ id: did, donor: pub, kind: 'money', category: r.pay_method,
                          amount: r.amount, donated_on: todayLocal(),
                          created_at: new Date().toISOString() })
    d.priv[did] = { real_name: r.donor_name,
                    note: `Sponsorship: ${r.item_label || 'General'} · ${r.email}` }
    r.status = 'confirmed'; r.donation_id = did
    if (r.item_id) d.sponsorItems = d.sponsorItems.map((i) =>
      (i.id === r.item_id ? { ...i, status: 'taken', sponsor_name: pub } : i))
    writeDemo(d); return 'ok'
  }
  const { data, error } = await supabase.rpc('confirm_sponsorship', { p_request_id: id })
  if (error) throw error
  return data
}

/** Committee: decline or reopen. Frees the item and removes any donation row. */
export async function declineSponsorship(id) {
  if (!isConfigured) {
    const d = readDemo()
    const r = d.sponsorRequests.find((x) => x.id === id)
    if (!r) return 'no-such-request'
    if (r.donation_id) {
      d.donations = d.donations.filter((x) => x.id !== r.donation_id)
      delete d.priv[r.donation_id]
    }
    r.status = 'declined'; r.donation_id = null
    if (r.item_id) d.sponsorItems = d.sponsorItems.map((i) =>
      (i.id === r.item_id ? { ...i, status: 'available', sponsor_name: null } : i))
    writeDemo(d); return 'ok'
  }
  const { data, error } = await supabase.rpc('decline_sponsorship', { p_request_id: id })
  if (error) throw error
  return data
}

/* ------------------------------------------------------------- live feed -- */

/** Fires whenever anything the caller can see changes. Returns an unsubscribe fn. */
export function onChange(cb) {
  if (!isConfigured) {
    const h = () => cb()
    window.addEventListener('mgu:demo-change', h)
    window.addEventListener('storage', h)
    return () => {
      window.removeEventListener('mgu:demo-change', h)
      window.removeEventListener('storage', h)
    }
  }
  const ch = supabase
    .channel('mgu-live')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => cb())
    .subscribe()
  return () => supabase.removeChannel(ch)
}

export { ANON }
