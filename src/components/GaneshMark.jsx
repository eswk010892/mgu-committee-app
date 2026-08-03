import React from 'react'

/**
 * Stylized Ganesha line mark. Inline SVG — no asset, no request, base-path safe.
 * `ring` draws the static halo, `spin` adds the travelling aarti arc (loading only).
 * Colour comes from `currentColor`, so callers set it with CSS (`color:var(--marigold)`).
 */
export default function GaneshMark({ size = 96, ring = false, spin = false, label = '', className = '', ...rest }) {
  const a11y = label
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': 'true', focusable: 'false' }
  return (
    <svg className={['gmark', className].filter(Boolean).join(' ')} width={size} height={size}
      viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" {...a11y} {...rest}>
      {ring && <circle className="g-ring" cx="32" cy="32" r="27" strokeWidth="1.25" />}
      {spin && <circle className="g-aarti" cx="32" cy="32" r="27" />}
      <path d="M27 16c1-5 3-8 5-10 2 2 4 5 5 10" />
      <path d="M23 34c0-13 4-19 9-19s9 6 9 19" />
      <path d="M23 19c-10-3-15 5-14 13 1 8 7 12 14 9" />
      <path d="M41 19c10-3 15 5 14 13-1 8-7 12-14 9" />
      <path d="M32 31c0 8-1 13-4 17-3 4-8 4-9 0-1-3 1-5 3-4" />
      <path d="M36 36l4 6" />
      <path d="M28 36l-2 3" />
      <circle cx="26.5" cy="28" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="37.5" cy="28" r="1.5" fill="currentColor" stroke="none" />
      <circle className="g-tilak" cx="32" cy="22" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  )
}
