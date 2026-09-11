export const uid = () => Math.random().toString(36).slice(2, 10)

/** Today's date as YYYY-MM-DD in the *local* timezone. `toISOString()` would give UTC,
 *  which rolls over to tomorrow during Montreal evenings — exactly when donations land. */
export const todayLocal = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function dayDate(cfg, i) {
  const d = new Date((cfg.start_date || '2026-09-14') + 'T12:00:00')
  d.setDate(d.getDate() + i)
  return d
}

/**
 * Which day of the festival today is, 0-based, clamped to the festival's length.
 * Before sthapana it is Day 1; after the last day it stays on the last day.
 *
 * Both ends are anchored at local noon for the same reason `dayDate` is — a
 * midnight anchor drifts by an hour across the DST change and can round to the
 * wrong day.
 */
export function currentDayIndex(cfg) {
  const n = Math.max(1, Math.min(11, Number(cfg.days) || 1))
  const start = dayDate(cfg, 0)
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  const i = Math.round((now - start) / 86400000)
  return Math.max(0, Math.min(n - 1, i))
}

export const fmtDay = (d) =>
  d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })

export const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * The order sponsorship items are shown in, on the committee tab and the donor
 * page alike.
 *
 *   1. by festival day, general (no day) last — the donor page filters to one
 *      day at a time, so this only groups the committee's full list;
 *   2. anything still open before anything already sponsored, so what needs
 *      attention is at the top;
 *   3. dearest first, because that is what the committee wants claimed;
 *   4. open-amount items (0) after the priced ones, then the order they were
 *      added, so the list never reshuffles for two items of the same price.
 */
export function bySponsorOrder(a, b) {
  const day = (x) => (x.day_index == null ? 99 : x.day_index)
  if (day(a) !== day(b)) return day(a) - day(b)
  const open = (x) => (x.status === 'taken' ? 1 : 0)
  if (open(a) !== open(b)) return open(a) - open(b)
  const amt = (x) => Number(x.amount) || 0
  if (amt(a) !== amt(b)) return amt(b) - amt(a)
  return (a.sort_order || 0) - (b.sort_order || 0)
}

export function toCSV(rows, cols) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.map(esc).join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export function download(filename, text, type = 'text/csv;charset=utf-8') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}
