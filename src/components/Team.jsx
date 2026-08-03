import React from 'react'
import { Shield } from 'lucide-react'

/**
 * Read-only. Membership decides who can sign in and edit, so it is managed in
 * Supabase (Authentication -> Users, then a row in committee_members) rather
 * than from inside the app. An app that can grant itself access is not a lock.
 */
export default function Team({ people, tasks, me }) {
  return (
    <>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Committee</h2>

      <div className="card">
        {people.length === 0 ? (
          <div className="empty">No members loaded.</div>
        ) : people.map((p) => {
          const load = tasks.filter((t) => t.owner === p.name && t.status !== 'done').length
          return (
            <div className="item" key={p.id}>
              <div className="row">
                <div style={{ flex: 1 }}>
                  <div className="item-t">
                    {p.name}{p.name === me && <span className="chip chip-on" style={{ marginLeft: 6 }}>you</span>}
                  </div>
                  <div className="item-m">{[p.role, p.phone].filter(Boolean).join(' · ') || 'No role set'}</div>
                </div>
                <span className="chip">{load} open</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={14} /> Adding or removing a member
        </h3>
        <div className="item-m">
          Joining is self-serve: share the app link with <code>#join</code> and the current invite
          code from the <code>invite_codes</code> table — codes expire and have limited uses. If needed,
          an admin can also add someone manually in Supabase (<b>Authentication → Users</b>, then a row
          in <code>committee_members</code>). Removing that row revokes their access immediately.
        </div>
        <div className="item-m" style={{ marginTop: 8 }}>
          Phone numbers here are visible to signed-in committee members only — never on the public page.
        </div>
      </div>
    </>
  )
}
