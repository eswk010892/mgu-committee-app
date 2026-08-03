import React, { useState } from 'react'
import { ArrowLeft } from 'lucide-react'

export default function Login({ auth, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async () => {
    if (!email.trim() || !password) { setMsg({ bad: true, text: 'Enter your email and password.' }); return }
    setBusy(true); setMsg(null)
    const { error } = await auth.signIn(email.trim(), password)
    setBusy(false)
    if (error) setMsg({ bad: true, text: error.message })
  }

  const reset = async () => {
    if (!email.trim()) { setMsg({ bad: true, text: 'Enter your email first, then tap reset.' }); return }
    setBusy(true); setMsg(null)
    const { error } = await auth.resetPassword(email.trim())
    setBusy(false)
    setMsg(error ? { bad: true, text: error.message }
                 : { bad: false, text: 'Check your email for the reset link.' })
  }

  return (
    <div className="mgu-shell" style={{ paddingBottom: 40, maxWidth: 420 }}>
      <header className="mgu-top">
        <button className="btn btn-ghost" onClick={onBack} style={{ paddingLeft: 0, marginBottom: 8 }}>
          <ArrowLeft size={15} /> Back to the dashboard
        </button>
        <div className="mgu-eyebrow">Committee only</div>
        <h1 className="mgu-title">Sign in</h1>
      </header>

      <div className="card">
        <label className="fld"><span>Email</span>
          <input type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>
        <label className="fld"><span>Password</span>
          <input type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>

        {msg && (
          <div className="banner" style={{
            borderColor: msg.bad ? 'var(--vermilion)' : 'var(--leaf)',
            background: msg.bad ? 'rgba(214,52,28,.14)' : 'rgba(78,154,107,.14)' }}>
            {msg.text}
          </div>
        )}

        <button className="btn btn-go" onClick={submit} disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button className="btn btn-ghost" onClick={reset} disabled={busy}
          style={{ width: '100%', marginTop: 8 }}>Forgot password</button>
      </div>

      <div className="item-m" style={{ textAlign: 'center', marginTop: 14 }}>
        Accounts are created by a committee admin. There is no public sign-up.
      </div>
    </div>
  )
}
