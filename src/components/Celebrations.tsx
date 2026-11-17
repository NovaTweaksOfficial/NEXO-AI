import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame, Gift, Sparkles, Star, Trophy } from 'lucide-react'
import { useProgress, type Celebration } from '@/state/progress'
import { useSettings } from '@/state/settings'

const ICONS = {
  xp: Sparkles,
  level: Star,
  achievement: Trophy,
  quest: Gift,
  streak: Flame,
} as const

function Toast({ item, onDone, reduce }: { item: Celebration; onDone: (id: string) => void; reduce: boolean }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(item.id), item.kind === 'level' ? 4200 : 3200)
    return () => window.clearTimeout(timer)
  }, [item.id, item.kind, onDone])

  const Icon = ICONS[item.kind]
  return (
    <motion.div
      className={`celebration-toast celebration-${item.kind}`}
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.94 }}
      transition={{ duration: reduce ? 0 : 0.24, ease: 'easeOut' }}
    >
      <div className="celebration-icon">{item.icon || <Icon size={18} />}</div>
      <div style={{ minWidth: 0 }}>
        <div className="celebration-title">{item.title}</div>
        {item.detail && <div className="celebration-detail">{item.detail}</div>}
      </div>
      <span className="celebration-spark" aria-hidden="true">✦</span>
    </motion.div>
  )
}

export function Celebrations() {
  const { celebrations, dismiss } = useProgress()
  const { settings } = useSettings()
  if (!settings.funMode) return null
  return (
    <div className="celebration-stack" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {celebrations.map(item => (
          <Toast key={item.id} item={item} onDone={dismiss} reduce={settings.reducedMotion} />
        ))}
      </AnimatePresence>
    </div>
  )
}
