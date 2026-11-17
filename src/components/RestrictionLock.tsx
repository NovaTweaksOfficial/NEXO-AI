import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/state/auth'
import { playTap } from '@/lib/sounds'

// Full-screen hold. Nothing else in the app is rendered while this is up, and
// the server enforces the same restriction on every API request. The only
// action offered is signing out, so a restricted user can return to the
// sign-in / create-account screen without being trapped in the app.
export function RestrictionLock({ message }: { message: string }) {
  const { signout } = useAuth()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const blockKeys = (e: KeyboardEvent) => {
      // Keep the rest of the app unreachable, but leave Tab / Enter / Space
      // working so the sign-out button stays keyboard accessible.
      if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    const warnBeforeLeaving = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('keydown', blockKeys, true)
    window.addEventListener('keyup', blockKeys, true)
    window.addEventListener('beforeunload', warnBeforeLeaving, true)
    return () => {
      window.removeEventListener('keydown', blockKeys, true)
      window.removeEventListener('keyup', blockKeys, true)
      window.removeEventListener('beforeunload', warnBeforeLeaving, true)
    }
  }, [])

  return (
    <div
      role="alert"
      aria-live="assertive"
      onContextMenu={e => e.preventDefault()}
      onDragStart={e => e.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'grid',
        placeItems: 'center',
        padding: 28,
        background: 'var(--bg, #080810)',
        color: 'var(--text, #ecebf6)',
        textAlign: 'center',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 17,
        lineHeight: 1.65,
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 520 }}>
        <p style={{ margin: 0 }}>{message}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            playTap()
            setBusy(true)
            void signout().finally(() => setBusy(false))
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '11px 20px', borderRadius: 12, cursor: 'pointer',
            border: '1px solid var(--border, rgba(139,92,246,0.3))',
            background: 'rgba(139,92,246,0.14)', color: 'var(--text, #ecebf6)',
            fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          <LogOut size={16} /> {busy ? 'Signing out…' : 'Sign out'}
        </button>
        <span style={{ fontSize: 11.5, color: 'var(--text-3, #6f6b88)', lineHeight: 1.5 }}>
          Signing out returns you to the sign-in screen, where you can sign in or create an account.
        </span>
      </div>
    </div>
  )
}
