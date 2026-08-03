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
import { uid } from './format.js'

/* ------------------------------------------------------------------ demo -- */

const LS = 'mgu:demo'
const blank = { cfg: DEFAULT_CFG, events: [], notes: {}, donations: [], priv: {}, tasks: [], people: [] }
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
