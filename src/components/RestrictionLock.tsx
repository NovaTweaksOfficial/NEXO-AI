import { useEffect } from 'react'

// Full-screen hold. Nothing else in the app is rendered while this is up, and
// the server enforces the same restriction on every API request (including
// sign-out), so closing or restarting the app does not restore access.
export function RestrictionLock({ message }: { message: string }) {
  useEffect(() => {
    const blockKeys = (e: KeyboardEvent) => {
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
      <p style={{ maxWidth: 520, margin: 0 }}>{message}</p>
    </div>
  )
}
