import React, { useState } from 'react'
import { ArrowLeft } from 'lucide-react'

export default function Login({ auth, onBack, initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
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

  const join = async () => {
    if (!name.trim() || !code.trim()) { setMsg({ bad: true, text: 'Enter your name and the invite code.' }); return }
    if (!auth.user && (!email.trim() || !password)) {
      setMsg({ bad: true, text: 'Enter your email and password.' }); return
    }
    setBusy(true); setMsg(null)

    if (!auth.user) {
      const { data, error } = await auth.signUp(email.trim(), password)
      if (error) {
        if (/already|registered/i.test(error.message)) {
          const { error: signInError } = await auth.signIn(email.trim(), password)
          if (signInError) {
            setBusy(false)
            setMsg({ bad: true, text: "This email already has an account and that password doesn't match it. Switch to Sign in or use Forgot password." })
            return
          }
        } else {
          setBusy(false)
          setMsg({ bad: true, text: error.message })
          return
        }
      } else if (!data.session) {
        setBusy(false)
        setMsg({ bad: false, text: 'Account created — check your email to confirm, then come back, sign in, and enter your invite code.' })
        return
      }
    }

    const { result, error: joinError } = await auth.joinCommittee(code.trim(), name.trim(), phone.trim())
    setBusy(false)
    if (joinError) { setMsg({ bad: true, text: joinError.message }); return }
    if (result === 'ok' || result === 'already-member') { auth.recheck(); return }
    if (result === 'bad-code') {
      setMsg({ bad: true, text: "That invite code isn't valid — it may have expired. Check the WhatsApp message or ask the admin." })
    } else if (result === 'name-required') {
      setMsg({ bad: true, text: 'Enter your name.' })
    } else {
      setMsg({ bad: true, text: result || 'Something went wrong. Try again.' })
    }
  }

  return (
    <div className="mgu-shell" style={{ paddingBottom: 40, maxWidth: 420 }}>
      <header className="mgu-top">
        <button className="btn btn-ghost" onClick={onBack} style={{ paddingLeft: 0, marginBottom: 8 }}>
          <ArrowLeft size={15} /> Back to the dashboard
        </button>
        <div className="mgu-eyebrow">Committee only</div>
        <h1 className="mgu-title">{mode === 'join' ? 'Join the committee' : 'Sign in'}</h1>
      </header>

      <div className="seg">
        <button className={'btn' + (mode === 'signin' ? ' btn-go' : '')}
          onClick={() => { setMode('signin'); setMsg(null) }}>Sign in</button>
        <button className={'btn' + (mode === 'join' ? ' btn-go' : '')}
          onClick={() => { setMode('join'); setMsg(null) }}>Join</button>
      </div>

      {mode === 'signin' ? (
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
      ) : (
        <div className="card">
          <label className="fld"><span>Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="fld"><span>Phone (optional)</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          {!auth.user && (
            <>
              <label className="fld"><span>Email</span>
                <input type="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} /></label>
              <label className="fld"><span>Password</span>
                <input type="password" autoComplete="new-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} /></label>
            </>
          )}
          <label className="fld"><span>Invite code</span>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && join()} /></label>

          {msg && (
            <div className="banner" style={{
              borderColor: msg.bad ? 'var(--vermilion)' : 'var(--leaf)',
              background: msg.bad ? 'rgba(214,52,28,.14)' : 'rgba(78,154,107,.14)' }}>
              {msg.text}
            </div>
          )}

          <button className="btn btn-go" onClick={join} disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? 'Joining…' : 'Join the committee'}
          </button>
        </div>
      )}

      <div className="item-m" style={{ textAlign: 'center', marginTop: 14 }}>
        Committee members join with the invite code from the WhatsApp group. No code — no access.
      </div>
    </div>
  )
}
