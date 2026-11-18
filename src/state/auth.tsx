import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser } from '@/types'
import { useSettings } from './settings'
import { login as apiLogin, logout as apiLogout, me as apiMe, register as apiRegister } from '@/lib/api'

type Status = 'loading' | 'signedOut' | 'signedIn' | 'guest'

interface StoredAuth {
  token: string
  user: AuthUser
}

const AUTH_KEY = 'nexus.auth'
const GUEST_KEY = 'nexus.guest'

function readStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.token || !parsed?.user?.email) return null
    return parsed
  } catch {
    return null
  }
}

interface Ctx {
  status: Status
  user: AuthUser | null
  token: string | null
  isSignedIn: boolean
  signup: (email: string, password: string) => Promise<void>
  signin: (email: string, password: string) => Promise<void>
  signout: () => Promise<void>
  continueAsGuest: () => void
  openAuth: () => void
}

const AuthCtx = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const backend = settings.backendUrl

  const [stored, setStored] = useState<StoredAuth | null>(() => readStored())
  const [guest, setGuest] = useState<boolean>(() => {
    try { return localStorage.getItem(GUEST_KEY) === '1' } catch { return false }
  })
  // Avoid an AuthView flash for returning guests while the session check runs.
  const [status, setStatus] = useState<Status>(() => {
    if (readStored()) return 'loading'
    try { return localStorage.getItem(GUEST_KEY) === '1' ? 'guest' : 'signedOut' } catch { return 'signedOut' }
  })

  // Validate an existing session once on load.
  useEffect(() => {
    let cancelled = false
    const current = readStored()
    if (!current) {
      setStatus(guest ? 'guest' : 'signedOut')
      return
    }
    setStatus('loading')
    apiMe(backend, current.token)
      .then(({ user }) => {
        if (cancelled) return
        const next = { token: current.token, user }
        localStorage.setItem(AUTH_KEY, JSON.stringify(next))
        setStored(next)
        setStatus('signedIn')
      })
      .catch((err: any) => {
        if (cancelled) return
        // Only drop the session when the server actually rejects it. A network
        // blip or an offline device should not sign the user out.
        if (err?.status === 401) {
          localStorage.removeItem(AUTH_KEY)
          setStored(null)
          setStatus(guest ? 'guest' : 'signedOut')
          return
        }
        setStored(current)
        setStatus('signedIn')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend])

  const persist = useCallback((next: StoredAuth) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(next))
    localStorage.removeItem(GUEST_KEY)
    setGuest(false)
    setStored(next)
    setStatus('signedIn')
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    const result = await apiRegister(backend, email, password)
    persist(result)
  }, [backend, persist])

  const signin = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(backend, email, password)
    persist(result)
  }, [backend, persist])

  const signout = useCallback(async () => {
    const current = readStored()
    if (current) {
      try { await apiLogout(backend, current.token) } catch { /* best effort */ }
    }
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(GUEST_KEY)
    setStored(null)
    setGuest(false)
    setStatus('signedOut')
  }, [backend])

  const continueAsGuest = useCallback(() => {
    try { localStorage.setItem(GUEST_KEY, '1') } catch { /* ignore */ }
    setGuest(true)
    setStatus('guest')
  }, [])

  const openAuth = useCallback(() => setStatus('signedOut'), [])

  const value = useMemo<Ctx>(() => ({
    status,
    user: stored?.user ?? null,
    token: stored?.token ?? null,
    isSignedIn: status === 'signedIn' && !!stored,
    signup,
    signin,
    signout,
    continueAsGuest,
    openAuth,
  }), [status, stored, signup, signin, signout, continueAsGuest, openAuth])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth outside provider')
  return ctx
}
