import { useState } from 'react'
import { useAuth } from '@/state/auth'
import { RobotMascot } from '@/components/RobotMascot'
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react'

export function AuthView() {
  const { signup, signin, continueAsGuest } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !password) { setError('Enter your email and password.'); return }
    if (mode === 'signup' && password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (mode === 'signup' && password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      if (mode === 'signup') await signup(cleanEmail, password)
      else await signin(cleanEmail, password)
    } catch (err: any) {
      setError(err?.message || 'Could not sign in. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 'calc(var(--safe-top) + 24px)' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <RobotMascot size={88} />
        <h1 className="title-gradient" style={{ fontSize: 30, margin: '10px 0 4px', fontWeight: 800 }}>NEXUS AI</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, margin: 0 }}>
          {mode === 'signup' ? 'Create your account to sync chats across devices.' : 'Welcome back. Sign in to continue.'}
        </p>
      </div>

      <form onSubmit={submit} className="glass" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Email</label>
        <div style={{ position: 'relative' }}>
          <Mail size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-3)' }} />
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ paddingLeft: 36 }}
          />
        </div>

        <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Password</label>
        <div style={{ position: 'relative' }}>
          <Lock size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-3)' }} />
          <input
            className="input"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
            style={{ paddingLeft: 36 }}
          />
        </div>

        {mode === 'signup' && (
          <>
            <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Confirm password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-3)' }} />
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                style={{ paddingLeft: 36 }}
              />
            </div>
          </>
        )}

        {error && <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>}

        <button className="btn primary" type="submit" disabled={busy} style={{ height: 44, marginTop: 4 }}>
          {busy ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>

        <button
          type="button"
          className="btn ghost"
          style={{ height: 40 }}
          onClick={() => { setMode(m => (m === 'signup' ? 'signin' : 'signup')); setError(null) }}
        >
          {mode === 'signup' ? 'I already have an account' : 'Create a new account'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button className="btn ghost" onClick={continueAsGuest} style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
          Continue without an account
        </button>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.6 }}>
          Accounts keep your chats, photos, and files synced. Guest mode keeps everything on this device only.
        </p>
      </div>
    </div>
  )
}
