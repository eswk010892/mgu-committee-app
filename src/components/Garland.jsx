import React from 'react'
import { dayDate, fmtDay } from '../lib/format.js'
import { DEVA } from '../lib/constants.js'

export default function Garland({ cfg, day, setDay, events }) {
  const n = Math.max(1, Math.min(11, Number(cfg.days) || 1))
  return (
    <div className="garland">
      <div className="garland-thread" />
      <div className="garland-row">
        {Array.from({ length: n }, (_, i) => {
          const d = dayDate(cfg, i)
          const count = events.filter((e) => e.day === i).length
          return (
            <button key={i} className="bead" data-on={day === i ? '1' : '0'}
              data-last={i === n - 1 ? '1' : '0'} onClick={() => setDay(i)}
              aria-label={`Day ${i + 1}, ${fmtDay(d)}, ${count} items`}>
              <span className="bead-dot">{i + 1}</span>
              <span className="bead-label">
                {d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}<br />
                <span className="deva">{DEVA[i] || ''}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
