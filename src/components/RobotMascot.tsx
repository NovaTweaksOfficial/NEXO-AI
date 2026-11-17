import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { RobotMood } from '@/lib/gamification'

export function RobotIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="18" y="26" width="84" height="70" rx="20" fill="#1a1a30" stroke="#8b5cf6" strokeWidth="5" />
      <rect x="30" y="40" width="60" height="40" rx="12" fill="#0a0a18" />
      <rect x="38" y="50" width="16" height="12" rx="4" fill="#a78bfa" />
      <rect x="66" y="50" width="16" height="12" rx="4" fill="#a78bfa" />
      <path d="M 46 70 Q 60 78 74 70" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

interface Props {
  size?: number
  className?: string
  /** When true, the eyes follow a nearby cursor and the robot reacts. */
  trackCursor?: boolean
  /** Changes eye color and expression to match what NEXUS just did. */
  mood?: RobotMood
  /** Optional speech bubble above the robot. */
  speech?: string
  /** Makes the companion tappable (mouse and keyboard). */
  onClick?: () => void
}

export function RobotMascot({ size = 96, className = '', trackCursor = false, mood = 'idle', speech, onClick }: Props) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ids = {
    metal: `metal-${rawId}`,
    metalHi: `metalHi-${rawId}`,
    eyeGlow: `eyeGlow-${rawId}`,
    glow: `glow-${rawId}`,
    softGlow: `softGlow-${rawId}`,
  }
  const ref = useRef<HTMLDivElement>(null)
  const [look, setLook] = useState({ x: 0, y: 0 })
  const [near, setNear] = useState(false)
  const [blink, setBlink] = useState(false)
  const reduce = useReducedMotion()

  // Eyes follow the pointer when it gets close to the robot.
  useEffect(() => {
    if (!trackCursor || reduce) return
    const onMove = (event: MouseEvent) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      const distance = Math.hypot(dx, dy)
      if (distance < 360) {
        setLook({
          x: Math.max(-1, Math.min(1, dx / 130)),
          y: Math.max(-1, Math.min(1, dy / 130)),
        })
        setNear(true)
      } else {
        setLook({ x: 0, y: 0 })
        setNear(false)
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [trackCursor, reduce])

  // Occasional blink.
  useEffect(() => {
    if (reduce) return
    let blinkTimer = 0
    let nextTimer = 0
    const schedule = () => {
      nextTimer = window.setTimeout(() => {
        setBlink(true)
        blinkTimer = window.setTimeout(() => {
          setBlink(false)
          schedule()
        }, 140)
      }, 2800 + Math.random() * 3600)
    }
    schedule()
    return () => {
      window.clearTimeout(blinkTimer)
      window.clearTimeout(nextTimer)
    }
  }, [reduce])

  const spring = { type: 'spring' as const, stiffness: 170, damping: 18 }
  const accent = mood === 'excited'
    ? '#f472b6'
    : mood === 'happy'
      ? '#22d3ee'
      : mood === 'focused'
        ? '#60a5fa'
        : '#a78bfa'
  const smiling = mood === 'happy' || mood === 'excited'
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <motion.div
      ref={ref}
      className={`float-anim ${className}`}
      style={{ width: size, height: size, position: 'relative', cursor: onClick ? 'pointer' : undefined }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? 'Talk to NEXUS companion' : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      {speech && (
        <div className="robot-speech" role="status">
          {speech}
          <span className="robot-speech-tail" aria-hidden="true" />
        </div>
      )}
      <svg viewBox="0 0 120 120" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={ids.metal} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2a2a4a" />
            <stop offset="50%" stopColor="#1a1a30" />
            <stop offset="100%" stopColor="#0f0f1e" />
          </linearGradient>
          <linearGradient id={ids.metalHi} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a5a8a" />
            <stop offset="100%" stopColor="#1a1a30" />
          </linearGradient>
          <radialGradient id={ids.eyeGlow} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} />
            <stop offset="60%" stopColor={accent} stopOpacity="0.75" />
            <stop offset="100%" stopColor="#3b82f6" />
          </radialGradient>
          <filter id={ids.glow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={ids.softGlow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* antenna: pulses brighter when the cursor is near */}
        <line x1="60" y1="14" x2="60" y2="26" stroke="#8b5cf6" strokeWidth="2" filter={`url(#${ids.softGlow})`} />
        <circle
          cx="60" cy="12" r={near ? 5.6 : 4} fill={`url(#${ids.eyeGlow})`} filter={`url(#${ids.glow})`}
          opacity={near ? 1 : 0.85}
          style={{ transition: 'r 180ms ease-out' }}
        />
        {near && (
          <circle cx="60" cy="12" r="9" fill="none" stroke="#a78bfa" strokeWidth="0.8" opacity="0.55">
            <animate attributeName="r" values="7;11;7" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="1.2s" repeatCount="indefinite" />
          </circle>
        )}

        <motion.g
          animate={{ rotate: look.x * 4, x: look.x * 1.5 }}
          transition={spring}
          style={{ transformOrigin: '60px 62px' }}
        >
          {/* head */}
          <rect x="24" y="26" width="72" height="68" rx="18" fill={`url(#${ids.metal})`} stroke="#8b5cf6" strokeWidth="1.5" />
          <rect x="24" y="26" width="72" height="68" rx="18" fill="none" stroke="rgba(139,92,246,0.4)" strokeWidth="1" />

          {/* top highlight */}
          <rect x="30" y="30" width="60" height="8" rx="4" fill={`url(#${ids.metalHi})`} opacity="0.5" />

          {/* face panel */}
          <rect x="32" y="40" width="56" height="40" rx="12" fill="#0a0a18" stroke="rgba(139,92,246,0.25)" />

          {/* eyes */}
          <g filter={`url(#${ids.glow})`}>
            <rect x="38" y="50" width="16" height="12" rx="4" fill={`url(#${ids.eyeGlow})`} opacity="0.55" />
            <rect x="66" y="50" width="16" height="12" rx="4" fill={`url(#${ids.eyeGlow})`} opacity="0.55" />
            <g style={{ transform: `translate(${look.x * 5}px, ${look.y * 3.5}px)`, transition: 'transform 120ms ease-out' }}>
              <circle cx="46" cy="56" r={blink ? 0.6 : 4.5} fill="#c4b5fd" />
              <circle cx="74" cy="56" r={blink ? 0.6 : 4.5} fill="#c4b5fd" />
            </g>
          </g>
          <g style={{ transform: `translate(${look.x * 5}px, ${look.y * 3.5}px)`, transition: 'transform 120ms ease-out' }}>
            <rect x="40" y="52" width="6" height="3" rx="1.5" fill="#fff" opacity={blink ? 0 : 0.7} />
            <rect x="68" y="52" width="6" height="3" rx="1.5" fill="#fff" opacity={blink ? 0 : 0.7} />
          </g>

          {/* mouth reacts to cursor and mood */}
          {smiling ? (
            <path
              d={mood === 'excited' ? 'M 42 69 Q 60 83 78 69' : 'M 45 70 Q 60 78 75 70'}
              fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round"
            />
          ) : (
            <rect
              x={near ? 43 : 46} y="70" width={near ? 34 : 28} height="4" rx="2" fill={accent}
              opacity={near ? 1 : 0.8}
            />
          )}

          {/* side bolts */}
          <circle cx="28" cy="60" r="3" fill="#3b82f6" filter={`url(#${ids.softGlow})`} />
          <circle cx="92" cy="60" r="3" fill="#3b82f6" filter={`url(#${ids.softGlow})`} />

          {/* jaw */}
          <path d="M 30 94 Q 60 104 90 94" stroke="#8b5cf6" strokeWidth="1.5" fill="none" opacity="0.6" />

          {/* neck */}
          <rect x="48" y="94" width="24" height="8" rx="3" fill={`url(#${ids.metal})`} stroke="rgba(139,92,246,0.3)" />
        </motion.g>
      </svg>
    </motion.div>
  )
}
