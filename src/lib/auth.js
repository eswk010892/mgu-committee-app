import { useState, useEffect } from 'react'
import { supabase, isConfigured } from './supabase.js'

/**
 * Session state.
 *
 *   status: 'loading' | 'public' | 'pending' | 'committee'
 *
 *   public     — nobody signed in (or signed in but not on the committee list).
 *   pending    — signed in, but their uid is not in committee_members yet.
 *                They see the public dashboard and a note to contact an admin.
 *   committee  — full access.
 *
 * Demo mode (no Supabase keys) reports 'committee' so a fresh clone is usable,
 * and exposes `demo: true` so the UI can say so plainly.
 */
export function useAuth() {
  const [status, setStatus] = useState(isConfigured ? 'loading' : 'committee')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!isConfigured) return
    let alive = true

    const resolve = async (session) => {
      if (!alive) return
      if (!session?.user) { setUser(null); setProfile(null); setStatus('public'); return }
      setUser(session.user)
      const { data } = await supabase
        .from('committee_members').select('*').eq('user_id', session.user.id).maybeSingle()
      if (!alive) return
      if (data) { setProfile(data); setStatus('committee') }
      else { setProfile(null); setStatus('pending') }
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => resolve(session))
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  return {
    status, user, profile,
    demo: !isConfigured,
    isCommittee: status === 'committee',
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    }),
  }
}
