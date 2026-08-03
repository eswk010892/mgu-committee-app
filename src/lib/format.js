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

export const fmtDay = (d) =>
  d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })

export const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
