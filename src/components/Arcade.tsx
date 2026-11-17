import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gamepad2, RotateCcw, X } from 'lucide-react'
import { useUi } from '@/state/ui'
import { useProgress } from '@/state/progress'
import { useSettings } from '@/state/settings'
import { playGame, playTap } from '@/lib/sounds'

type Phase = 'idle' | 'showing' | 'input' | 'over'
const PADS = [
  { label: '◇', name: 'diamond' },
  { label: '△', name: 'triangle' },
  { label: '○', name: 'circle' },
  { label: '□', name: 'square' },
]

export function Arcade() {
  const { arcadeOpen, setArcadeOpen } = useUi()
  const { state, recordArcade } = useProgress()
  const { settings } = useSettings()
  const [sequence, setSequence] = useState<number[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [active, setActive] = useState<number | null>(null)
  const [pos, setPos] = useState(0)
  const [message, setMessage] = useState('Watch the pattern')
  const recordedRef = useRef(false)

  const round = sequence.length

  const nextRound = useCallback((current: number[]) => {
    const next = [...current, Math.floor(Math.random() * PADS.length)]
    setSequence(next)
    setPos(0)
    setMessage('Watch the pattern')
    setPhase('showing')
  }, [])

  const start = useCallback(() => {
    recordedRef.current = false
    setActive(null)
    nextRound([])
    playTap()
  }, [nextRound])

  // Flash the sequence one pad at a time, then hand control to the player.
  useEffect(() => {
    if (!arcadeOpen || phase !== 'showing') return
    let cancelled = false
    const timers: number[] = []
    sequence.forEach((pad, index) => {
      const at = index * 640
      timers.push(window.setTimeout(() => { if (!cancelled) setActive(pad) }, at))
      timers.push(window.setTimeout(() => { if (!cancelled) setActive(null) }, at + 380))
    })
    timers.push(window.setTimeout(() => {
      if (cancelled) return
      setActive(null)
      setPos(0)
      setMessage('Your turn · repeat the pattern')
      setPhase('input')
    }, sequence.length * 640 + 180))
    return () => {
      cancelled = true
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [arcadeOpen, phase, sequence])

  // A cleared round automatically becomes a longer one.
  useEffect(() => {
    if (!arcadeOpen || phase !== 'input' || pos < sequence.length || sequence.length === 0) return
    setMessage(`Round ${round} clear · getting harder`)
    playGame(true)
    const timer = window.setTimeout(() => nextRound(sequence), 750)
    return () => window.clearTimeout(timer)
  }, [arcadeOpen, phase, pos, sequence, round, nextRound])

  useEffect(() => {
    if (arcadeOpen) return
    setPhase('idle')
    setSequence([])
    setActive(null)
    setPos(0)
  }, [arcadeOpen])

  const press = (index: number) => {
    if (phase !== 'input') return
    playTap()
    const expected = sequence[pos]
    if (index !== expected) {
      const cleared = Math.max(0, round - 1)
      setPhase('over')
      setMessage(cleared ? `Nice · you cleared ${cleared} round${cleared === 1 ? '' : 's'}` : 'No rounds cleared yet · try again')
      setActive(null)
      if (!recordedRef.current) {
        recordedRef.current = true
        recordArcade(cleared)
      }
      playGame(false)
      return
    }
    setActive(index)
    window.setTimeout(() => setActive(null), 180)
    setPos(pos + 1)
  }

  return (
    <AnimatePresence>
      {arcadeOpen && (
        <motion.div
          className="arcade-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: settings.reducedMotion ? 0 : 0.16 }}
          onClick={() => setArcadeOpen(false)}
        >
          <motion.div
            className="arcade-panel"
            initial={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: settings.reducedMotion ? 0 : 0.22 }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="NEXUS Circuit arcade"
          >
            <div className="arcade-header">
              <div className="row" style={{ gap: 8 }}>
                <Gamepad2 size={20} style={{ color: 'var(--purple-2)' }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>NEXUS Circuit</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Best: {state.arcadeBest} rounds</div>
                </div>
              </div>
              <button className="btn ghost" style={{ padding: 6 }} onClick={() => setArcadeOpen(false)} aria-label="Close arcade">
                <X size={18} />
              </button>
            </div>

            <div className="arcade-screen">
              <div className="arcade-message">{phase === 'idle' ? 'Ready when you are.' : message}</div>
              <div className="arcade-dots" aria-hidden="true">
                {sequence.map((_, index) => (
                  <span key={index} className={index < pos ? 'done' : ''} />
                ))}
              </div>
              {phase !== 'idle' && <div className="arcade-round">Round {Math.max(1, round)}</div>}
            </div>

            <div className="arcade-pads">
              {PADS.map((pad, index) => (
                <button
                  key={pad.name}
                  className={`arcade-pad arcade-pad-${index} ${active === index ? 'active' : ''}`}
                  onClick={() => press(index)}
                  disabled={phase !== 'input'}
                  aria-label={`Pad ${pad.name}`}
                >
                  {pad.label}
                </button>
              ))}
            </div>

            <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
              <button className="btn primary" onClick={start}>
                <RotateCcw size={14} /> {phase === 'idle' ? 'Start' : 'Play again'}
              </button>
              <button className="btn ghost" onClick={() => setArcadeOpen(false)}>Close</button>
            </div>
            <div className="arcade-note">Offline memory game. No AI used. Best score saved on this device.</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
