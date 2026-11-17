import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchModerationStatus, type Restriction } from '@/lib/api'
import { useSettings } from './settings'
import { useAuth } from './auth'

interface Ctx {
  restriction: Restriction | null
  checking: boolean
  refresh: () => Promise<void>
}

const ModerationCtx = createContext<Ctx | null>(null)

export function ModerationProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const { token } = useAuth()
  const [restriction, setRestriction] = useState<Restriction | null>(null)
  const [checking, setChecking] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { restriction: next } = await fetchModerationStatus(settings.backendUrl, token)
      setRestriction(next)
    } catch {
      // The server is unreachable. Keep the last known state so a restriction
      // never quietly disappears just because the device went offline.
    } finally {
      setChecking(false)
    }
  }, [settings.backendUrl, token])

  useEffect(() => {
    let cancelled = false
    setChecking(true)
    void refresh().then(() => { if (!cancelled) setChecking(false) })
    const timer = setInterval(() => { void refresh() }, 8000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [refresh])

  return (
    <ModerationCtx.Provider value={{ restriction, checking, refresh }}>
      {children}
    </ModerationCtx.Provider>
  )
}

export function useModeration() {
  const ctx = useContext(ModerationCtx)
  if (!ctx) throw new Error('useModeration outside provider')
  return ctx
}
