import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { load, remove, save } from '@/lib/storage'
import { useAuth } from './auth'
import { useSettings } from './settings'
import {
  ACHIEVEMENTS,
  QUESTS,
  STAT_KEYS,
  dayKey,
  emptyStats,
  levelInfo,
  touchStreak,
  type Achievement,
  type LevelInfo,
  type Quest,
  type Stats,
} from '@/lib/gamification'
import { playAchievement, playLevelUp, playReact, playReward } from '@/lib/sounds'

export type LastAction = 'chat' | 'image' | 'tool' | 'reward' | 'game'

export interface ProgressState {
  xp: number
  streak: number
  longestStreak: number
  lastDay: string | null
  lastClaimDay: string | null
  stats: Stats
  achievements: Record<string, number>
  /** Event ids already rewarded. Keeps XP honest across reloads and double taps. */
  events: Record<string, true>
  daily: { day: string; quests: Record<string, number> }
  modes: string[]
  arcadeBest: number
  reactions: Record<string, string>
  lastAction?: LastAction
}

export interface Celebration {
  id: string
  kind: 'xp' | 'level' | 'achievement' | 'quest' | 'streak'
  title: string
  detail?: string
  icon?: string
}

interface AwardOptions {
  stats?: Partial<Stats>
  mode?: string
  arcadeBest?: number
  reactions?: Record<string, string>
  claimDay?: string
  lastAction?: LastAction
  extraTitle?: string
  silent?: boolean
}

interface Ctx {
  state: ProgressState
  level: LevelInfo
  celebrations: Celebration[]
  dismiss: (id: string) => void
  award: (eventId: string, xp: number, opts?: AwardOptions) => void
  claimDaily: () => void
  toggleReaction: (messageId: string, emoji: string) => void
  recordArcade: (score: number) => void
  reset: () => void
}

const ProgressCtx = createContext<Ctx | null>(null)

function freshState(): ProgressState {
  return {
    xp: 0,
    streak: 0,
    longestStreak: 0,
    lastDay: null,
    lastClaimDay: null,
    stats: emptyStats(),
    achievements: {},
    events: {},
    daily: { day: dayKey(), quests: {} },
    modes: [],
    arcadeBest: 0,
    reactions: {},
  }
}

function normalize(raw: Partial<ProgressState> | null): ProgressState {
  const base = freshState()
  if (!raw) return base
  const stats = { ...base.stats }
  for (const key of STAT_KEYS) stats[key] = Math.max(0, Math.floor(Number(raw.stats?.[key]) || 0))
  return {
    xp: Math.max(0, Math.floor(Number(raw.xp) || 0)),
    streak: Math.max(0, Math.floor(Number(raw.streak) || 0)),
    longestStreak: Math.max(0, Math.floor(Number(raw.longestStreak) || 0)),
    lastDay: typeof raw.lastDay === 'string' ? raw.lastDay : null,
    lastClaimDay: typeof raw.lastClaimDay === 'string' ? raw.lastClaimDay : null,
    stats,
    achievements: { ...(raw.achievements || {}) },
    events: { ...(raw.events || {}) },
    daily: {
      day: typeof raw.daily?.day === 'string' ? raw.daily.day : base.daily.day,
      quests: { ...(raw.daily?.quests || {}) },
    },
    modes: Array.isArray(raw.modes) ? raw.modes.filter((m): m is string => typeof m === 'string') : [],
    arcadeBest: Math.max(0, Math.floor(Number(raw.arcadeBest) || 0)),
    reactions: { ...(raw.reactions || {}) },
    lastAction: raw.lastAction,
  }
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const { status, user } = useAuth()
  const identity = status === 'signedIn' && user ? user.id : status === 'guest' ? 'guest' : null
  const key = identity ? `progress.${identity}` : null

  const [state, setState] = useState<ProgressState>(freshState)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const stateRef = useRef(state)
  const awardedRef = useRef<Set<string>>(new Set())
  stateRef.current = state

  // Progress is scoped per identity, exactly like conversations. Switching
  // accounts never mixes XP, streaks, badges, or message stickers.
  useEffect(() => {
    if (!key || loadedKey === key) return
    setLoadedKey(key)
    const next = normalize(load<Partial<ProgressState>>(key, freshState()))
    stateRef.current = next
    awardedRef.current = new Set(Object.keys(next.events))
    setCelebrations([])
    setState(next)
  }, [key, loadedKey])

  useEffect(() => {
    if (!key || loadedKey !== key) return
    save(key, state)
  }, [state, key, loadedKey])

  const pushCelebrations = useCallback((items: Celebration[]) => {
    if (!items.length || !settings.funMode) return
    setCelebrations(prev => [...prev, ...items].slice(-6))
    if (items.some(i => i.kind === 'level')) playLevelUp()
    else if (items.some(i => i.kind === 'achievement')) playAchievement()
    else playReward()
  }, [settings.funMode])

  const applyAward = useCallback((eventId: string, xp: number, opts: AwardOptions = {}) => {
    if (!eventId || !settings.funMode) return
    const prev = stateRef.current
    if (prev.events[eventId] || awardedRef.current.has(eventId)) return
    awardedRef.current.add(eventId)

    const today = dayKey()
    const streakInfo = touchStreak(prev.lastDay, prev.streak, today)
    const stats = { ...prev.stats }
    for (const stat of STAT_KEYS) {
      const inc = Math.max(0, Math.floor(Number(opts.stats?.[stat]) || 0))
      if (inc) stats[stat] = stats[stat] + inc
    }
    const modes = [...prev.modes]
    if (opts.mode && !modes.includes(opts.mode)) {
      modes.push(opts.mode)
      stats.modes += 1
    }

    const quests = prev.daily.day === today ? { ...prev.daily.quests } : {}
    const daily = { day: today, quests }
    const doneQuests: Quest[] = []
    let nextXp = Math.max(0, prev.xp + Math.max(0, Math.round(xp)))

    for (const quest of QUESTS) {
      const before = Math.max(0, Math.floor(Number(quests[quest.id]) || 0))
      const inc = Math.max(0, Math.floor(Number(opts.stats?.[quest.stat]) || 0))
      const after = before + inc
      quests[quest.id] = after
      if (before < quest.target && after >= quest.target) {
        nextXp += quest.xp
        doneQuests.push(quest)
      }
    }

    // Awards can unlock achievements, which themselves award XP and can unlock
    // more achievements. Loop until the state settles.
    const achievements = { ...prev.achievements }
    const unlocked: Achievement[] = []
    let changed = true
    while (changed) {
      changed = false
      const ctx = { stats, level: levelInfo(nextXp).level, streak: streakInfo.streak, modes }
      for (const achievement of ACHIEVEMENTS) {
        if (achievements[achievement.id]) continue
        if (!achievement.test(ctx)) continue
        achievements[achievement.id] = Date.now()
        nextXp += achievement.xp
        unlocked.push(achievement)
        changed = true
      }
    }

    const beforeLevel = levelInfo(prev.xp).level
    const afterLevel = levelInfo(nextXp).level

    const next: ProgressState = {
      ...prev,
      xp: nextXp,
      streak: streakInfo.streak,
      longestStreak: Math.max(prev.longestStreak, streakInfo.streak),
      lastDay: streakInfo.lastDay,
      lastClaimDay: opts.claimDay || prev.lastClaimDay,
      stats,
      achievements,
      events: { ...prev.events, [eventId]: true },
      daily,
      modes,
      arcadeBest: opts.arcadeBest !== undefined ? Math.max(prev.arcadeBest, opts.arcadeBest) : prev.arcadeBest,
      reactions: opts.reactions || prev.reactions,
      lastAction: opts.lastAction || prev.lastAction,
    }
    stateRef.current = next
    setState(next)

    if (opts.silent) return
    const items: Celebration[] = []
    if (xp > 0) {
      items.push({
        id: `${eventId}-xp`,
        kind: 'xp',
        title: `+${xp} XP`,
        detail: opts.extraTitle || 'Nice work',
        icon: '✨',
      })
    }
    if (afterLevel > beforeLevel) {
      items.push({ id: `${eventId}-level`, kind: 'level', title: `Level ${afterLevel}!`, detail: 'NEXUS Core evolved', icon: '⭐' })
    }
    for (const achievement of unlocked) {
      items.push({
        id: `${eventId}-badge-${achievement.id}`,
        kind: 'achievement',
        title: achievement.name,
        detail: `+${achievement.xp} XP · ${achievement.description}`,
        icon: achievement.icon,
      })
    }
    for (const quest of doneQuests) {
      items.push({
        id: `${eventId}-quest-${quest.id}`,
        kind: 'quest',
        title: `${quest.name} complete`,
        detail: `+${quest.xp} XP daily quest`,
        icon: quest.icon,
      })
    }
    pushCelebrations(items)
  }, [pushCelebrations, settings.funMode])

  const award = useCallback((eventId: string, xp: number, opts?: AwardOptions) => {
    applyAward(eventId, xp, opts)
  }, [applyAward])

  const claimDaily = useCallback(() => {
    const prev = stateRef.current
    const today = dayKey()
    if (prev.lastClaimDay === today) return
    const streak = touchStreak(prev.lastDay, prev.streak, today).streak
    const bonus = 15 + Math.min(Math.max(streak, 1), 7) * 2
    applyAward(`daily-${today}`, bonus, {
      claimDay: today,
      lastAction: 'reward',
      extraTitle: `${streak}-day streak bonus`,
    })
  }, [applyAward])

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    const prev = stateRef.current
    const current = prev.reactions[messageId]
    const reactions = { ...prev.reactions }
    if (current === emoji) delete reactions[messageId]
    else reactions[messageId] = emoji
    playReact()

    if (current || !settings.funMode) {
      const next = { ...prev, reactions }
      stateRef.current = next
      setState(next)
      return
    }
    applyAward(`reaction-${messageId}`, 2, {
      reactions,
      stats: { reactions: 1 },
      lastAction: 'reward',
      extraTitle: 'Reaction added',
    })
  }, [applyAward, settings.funMode])

  const recordArcade = useCallback((score: number) => {
    const rounds = Math.max(0, Math.floor(score))
    const prev = stateRef.current
    if (rounds <= prev.arcadeBest) return
    applyAward(`arcade-${rounds}`, Math.min(25, 5 + rounds * 2), {
      stats: { arcade: Math.max(1, rounds - prev.arcadeBest) },
      arcadeBest: rounds,
      lastAction: 'game',
      extraTitle: `New best: ${rounds} round${rounds === 1 ? '' : 's'}`,
    })
  }, [applyAward])

  const dismiss = useCallback((id: string) => {
    setCelebrations(prev => prev.filter(item => item.id !== id))
  }, [])

  const reset = useCallback(() => {
    const next = freshState()
    stateRef.current = next
    awardedRef.current.clear()
    setCelebrations([])
    setState(next)
    if (key) remove(key)
  }, [key])

  const level = useMemo(() => levelInfo(state.xp), [state.xp])
  const value = useMemo<Ctx>(() => ({
    state,
    level,
    celebrations,
    dismiss,
    award,
    claimDaily,
    toggleReaction,
    recordArcade,
    reset,
  }), [state, level, celebrations, dismiss, award, claimDaily, toggleReaction, recordArcade, reset])

  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>
}

export function useProgress() {
  const ctx = useContext(ProgressCtx)
  if (!ctx) throw new Error('useProgress outside provider')
  return ctx
}
