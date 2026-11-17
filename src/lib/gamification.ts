// Local progression rules. No network calls, no account changes, no fake AI.
// Everything here is pure so the provider can stay predictable and offline.

export type StatKey = 'messages' | 'images' | 'tools' | 'reactions' | 'arcade' | 'night' | 'modes'
export type Stats = Record<StatKey, number>
export type RobotMood = 'idle' | 'happy' | 'excited' | 'focused'

export const STAT_KEYS: StatKey[] = ['messages', 'images', 'tools', 'reactions', 'arcade', 'night', 'modes']

export function emptyStats(): Stats {
  return { messages: 0, images: 0, tools: 0, reactions: 0, arcade: 0, night: 0, modes: 0 }
}

export function dayKey(ts: number = Date.now()): string {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function nextDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, (m || 1) - 1, (d || 1) + 1).getTime())
}

export function touchStreak(lastDay: string | null, streak: number, today = dayKey()): { lastDay: string; streak: number } {
  if (lastDay === today) return { lastDay: today, streak }
  if (lastDay && nextDayKey(lastDay) === today) return { lastDay: today, streak: streak + 1 }
  return { lastDay: today, streak: 1 }
}

export interface LevelInfo {
  level: number
  current: number
  needed: number
  progress: number
}

/** Level 1→2 costs 100 XP, then each level costs 50 more. */
export function levelInfo(xp: number): LevelInfo {
  let level = 1
  let consumed = 0
  while (level < 999) {
    const needed = 100 + (level - 1) * 50
    if (xp < consumed + needed) {
      return {
        level,
        current: Math.max(0, xp - consumed),
        needed,
        progress: Math.max(0, Math.min(100, ((xp - consumed) / needed) * 100)),
      }
    }
    consumed += needed
    level++
  }
  return { level, current: 0, needed: 1, progress: 100 }
}

export interface AchievementCtx {
  stats: Stats
  level: number
  streak: number
  modes: string[]
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  xp: number
  test: (ctx: AchievementCtx) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-chat', name: 'First Contact', description: 'Get your first real reply', icon: '🤖', xp: 10, test: c => c.stats.messages >= 1 },
  { id: 'chat-10', name: 'Conversation Starter', description: 'Get 10 replies', icon: '💬', xp: 50, test: c => c.stats.messages >= 10 },
  { id: 'chat-50', name: 'Deep Thinker', description: 'Get 50 replies', icon: '🧠', xp: 150, test: c => c.stats.messages >= 50 },
  { id: 'first-image', name: 'Picture Perfect', description: 'Create your first image', icon: '🎨', xp: 25, test: c => c.stats.images >= 1 },
  { id: 'image-10', name: 'Visual Artist', description: 'Create 10 images', icon: '🖼️', xp: 100, test: c => c.stats.images >= 10 },
  { id: 'first-tool', name: 'Toolbox Tinkerer', description: 'Run a tool', icon: '🧰', xp: 20, test: c => c.stats.tools >= 1 },
  { id: 'tool-10', name: 'Power User', description: 'Run 10 tools', icon: '⚙️', xp: 100, test: c => c.stats.tools >= 10 },
  { id: 'streak-3', name: 'On a Roll', description: '3-day streak', icon: '🔥', xp: 40, test: c => c.streak >= 3 },
  { id: 'streak-7', name: 'Week Warrior', description: '7-day streak', icon: '🌟', xp: 100, test: c => c.streak >= 7 },
  { id: 'level-5', name: 'Level 5', description: 'Reach level 5', icon: '⬆️', xp: 75, test: c => c.level >= 5 },
  { id: 'level-10', name: 'Level 10', description: 'Reach level 10', icon: '👑', xp: 200, test: c => c.level >= 10 },
  { id: 'react-5', name: 'Good Vibes', description: 'React to 5 replies', icon: '💜', xp: 30, test: c => c.stats.reactions >= 5 },
  { id: 'all-modes', name: 'Mode Explorer', description: 'Use all five modes', icon: '🧭', xp: 60, test: c => c.modes.length >= 5 },
  { id: 'night-owl', name: 'Night Owl', description: 'Chat after 10 PM', icon: '🦉', xp: 25, test: c => c.stats.night >= 1 },
  { id: 'arcade-5', name: 'Circuit Breaker', description: 'Reach round 5 in the arcade', icon: '🎮', xp: 50, test: c => c.stats.arcade >= 5 },
]

export interface Quest {
  id: string
  name: string
  description: string
  stat: StatKey
  target: number
  xp: number
  icon: string
}

export const QUESTS: Quest[] = [
  { id: 'daily-chat', name: 'Brainstorm', description: 'Get 3 replies from NEXUS', stat: 'messages', target: 3, xp: 30, icon: '💬' },
  { id: 'daily-image', name: 'Make something', description: 'Create 1 image', stat: 'images', target: 1, xp: 25, icon: '🎨' },
  { id: 'daily-tool', name: 'Run a tool', description: 'Finish 1 Toolbox run', stat: 'tools', target: 1, xp: 20, icon: '🧰' },
  { id: 'daily-react', name: 'Spread good vibes', description: 'React to 2 replies', stat: 'reactions', target: 2, xp: 15, icon: '💜' },
]

export const QUICK_REACTIONS = ['🔥', '💜', '🧠', '😂', '⚡', '🚀']

export const COMPANION_LINES: Record<RobotMood, string[]> = {
  idle: ['Ready when you are.', 'Ask me anything.', 'Circuits calm. Curious.', 'What are we making?'],
  happy: ['That was fun!', 'Nice one.', 'I like that idea.', 'Looking good!'],
  excited: ['We are on a roll!', 'Level up energy!', 'This is my favorite part.', 'Keep it going!'],
  focused: ['Processing… deeply.', 'Ideas loading.', 'Thinking in circuits.', 'Locked on.'],
}

export function moodFrom(lastAction: string | undefined, level: number, streak: number): RobotMood {
  if (level >= 10 || streak >= 7) return 'excited'
  if (lastAction === 'chat') return 'focused'
  if (lastAction === 'image' || lastAction === 'tool' || lastAction === 'reward') return 'happy'
  return 'idle'
}
