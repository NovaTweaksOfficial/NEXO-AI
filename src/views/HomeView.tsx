import { useState } from 'react'
import { useUi } from '@/state/ui'
import { useSettings } from '@/state/settings'
import { useAuth } from '@/state/auth'
import { useChat } from '@/state/chat'
import { useProgress } from '@/state/progress'
import { RobotMascot } from '@/components/RobotMascot'
import { playTap } from '@/lib/sounds'
import {
  ACHIEVEMENTS, COMPANION_LINES, QUESTS, dayKey, moodFrom,
} from '@/lib/gamification'
import {
  Code2, Command, Flame, Gamepad2, Lightbulb, PenTool, Search, Sparkles, Trophy, Zap,
} from 'lucide-react'

const SUGGESTED = [
  { text: 'Explain something complicated.', icon: Lightbulb },
  { text: 'Build me a complete mod menu.', icon: Code2 },
  { text: 'Write something for me.', icon: PenTool },
  { text: 'Generate creative ideas.', icon: Sparkles },
  { text: 'Help me understand code.', icon: Code2 },
  { text: 'Research this for me.', icon: Search },
]

const QUICK_TOOLS = [
  { id: 'writer', label: 'Write', icon: PenTool },
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'gorilla-tag-mods', label: 'Build a mod', icon: Zap },
]

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function HomeView() {
  const { setTab, setPaletteOpen, setArcadeOpen, setPendingTool } = useUi()
  const { settings } = useSettings()
  const { status } = useAuth()
  const { current } = useChat()
  const { state, level, claimDaily } = useProgress()
  const [showAllBadges, setShowAllBadges] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)

  const mood = moodFrom(state.lastAction, level.level, state.streak)
  const lines = COMPANION_LINES[mood]
  const speech = settings.companion ? lines[lineIndex % lines.length] : undefined
  const today = dayKey()
  const claimed = state.lastClaimDay === today
  const dailyBonus = 15 + Math.min(Math.max(state.streak, 1), 7) * 2
  const unlocked = ACHIEVEMENTS.filter(a => state.achievements[a.id])
  const badges = showAllBadges
    ? ACHIEVEMENTS
    : [...unlocked.slice(-4), ...ACHIEVEMENTS.filter(a => !state.achievements[a.id]).slice(0, 2)]

  const startPrompt = (text: string) => {
    playTap()
    setTab('chat')
    sessionStorage.setItem('nexus.pendingPrompt', text)
  }

  const openTool = (id: string) => {
    playTap()
    setPendingTool(id)
    setTab('toolbox')
  }

  return (
    <div className="page home-page">
      <header className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="title-gradient" style={{ fontSize: 26, margin: 0, fontWeight: 800 }}>NEXUS AI</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, margin: '4px 0 0' }}>{greeting()}. Core is online.</p>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost" style={{ padding: '7px 9px' }} onClick={() => { playTap(); setPaletteOpen(true) }} aria-label="Open command palette">
            <Command size={17} /> <span style={{ fontSize: 11 }}>⌘K</span>
          </button>
          {settings.companion && (
            <RobotMascot
              size={66}
              mood={mood}
              speech={speech}
              trackCursor={!settings.reducedMotion}
              onClick={() => { playTap(); setLineIndex(i => i + 1) }}
            />
          )}
        </div>
      </header>

      {/* Level + streak hero */}
      <div className="hero-card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="hero-eyebrow">NEXUS OPERATOR</div>
            <div className="hero-level">Level {level.level}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
              {status === 'signedIn' ? 'Progress saved for this account on this device' : 'Progress saved on this device'}
            </div>
          </div>
          <div
            className="xp-ring"
            style={{ background: `conic-gradient(var(--purple-2) ${level.progress}%, rgba(255,255,255,0.08) 0)` }}
            aria-label={`${Math.round(level.progress)}% to next level`}
          >
            <div className="xp-ring-inner">
              <strong>{level.level}</strong>
              <span>LVL</span>
            </div>
          </div>
        </div>
        <div className="xp-track" style={{ marginTop: 14 }}>
          <div className="xp-fill" style={{ width: `${level.progress}%` }} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: 'var(--text-3)' }}>
          <span>{level.current} / {level.needed} XP to level {level.level + 1}</span>
          <span>{state.xp} total XP</span>
        </div>
        <div className="streak-box">
          <div className="row" style={{ gap: 10 }}>
            <span className="streak-flame"><Flame size={20} fill="currentColor" /></span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{state.streak}-day streak</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Best {state.longestStreak} days · keep it alive</div>
            </div>
          </div>
          <button
            className={`btn ${claimed ? 'ghost' : 'primary'}`}
            style={{ padding: '7px 10px', fontSize: 12 }}
            disabled={claimed}
            onClick={() => { playTap(); claimDaily() }}
          >
            {claimed ? 'Claimed ✓' : `Claim +${dailyBonus}`}
          </button>
        </div>
        <div className="home-stats">
          <div><strong>{state.stats.messages}</strong><span>replies</span></div>
          <div><strong>{state.stats.images}</strong><span>images</span></div>
          <div><strong>{state.stats.tools}</strong><span>tools</span></div>
          <div><strong>{state.arcadeBest}</strong><span>best game</span></div>
        </div>
      </div>

      <div className="section-title">Continue</div>
      <div className="card continue-card" onClick={() => { playTap(); setTab('chat') }} role="button" tabIndex={0}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {current ? current.title : 'Ask NEXUS anything…'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
              {current ? `${current.messages.length} messages · tap to jump back in` : 'Chat, create images, search the web, or build something.'}
            </div>
          </div>
          <Sparkles size={18} style={{ color: 'var(--purple-2)', flexShrink: 0 }} />
        </div>
      </div>

      <div className="section-title">Daily quests</div>
      <div className="glass" style={{ padding: 12 }}>
        {QUESTS.map(quest => {
          const progress = state.daily.day === today ? Math.min(quest.target, state.daily.quests[quest.id] || 0) : 0
          const done = progress >= quest.target
          return (
            <div key={quest.id} className="quest-row">
              <span className="quest-icon">{quest.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 12.5 }}>{quest.name}</strong>
                  <span style={{ fontSize: 11, color: done ? 'var(--success)' : 'var(--text-3)' }}>
                    {progress}/{quest.target} · +{quest.xp} XP
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 5px' }}>{quest.description}</div>
                <div className="quest-track"><div className={done ? 'quest-fill done' : 'quest-fill'} style={{ width: `${Math.round((progress / quest.target) * 100)}%` }} /></div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="section-title">Badges</div>
      <div className="glass" style={{ padding: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <Trophy size={16} style={{ color: 'var(--purple-2)' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{unlocked.length} / {ACHIEVEMENTS.length} unlocked</span>
          </div>
          <button className="btn ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => { playTap(); setShowAllBadges(v => !v) }}>
            {showAllBadges ? 'Show less' : 'View all'}
          </button>
        </div>
        <div className="badge-grid">
          {badges.map(achievement => {
            const owned = !!state.achievements[achievement.id]
            return (
              <div key={achievement.id} className={`badge ${owned ? 'owned' : 'locked'}`} title={`${achievement.name} · ${achievement.description}`}>
                <span>{achievement.icon}</span>
                <div style={{ fontSize: 10, lineHeight: 1.2 }}>{achievement.name}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="section-title">Suggested prompts</div>
      <div className="prompt-grid">
        {SUGGESTED.map((s, i) => {
          const Icon = s.icon
          return (
            <button key={i} className="prompt-card" onClick={() => startPrompt(s.text)}>
              <Icon size={16} style={{ color: 'var(--purple-2)' }} />
              <span>{s.text}</span>
            </button>
          )
        })}
      </div>

      <div className="section-title">Quick tools</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {QUICK_TOOLS.map(tool => {
          const Icon = tool.icon
          return (
            <button key={tool.id} className="btn ghost" style={{ fontSize: 12 }} onClick={() => openTool(tool.id)}>
              <Icon size={14} /> {tool.label}
            </button>
          )
        })}
      </div>

      <div className="section-title">Playground</div>
      <div className="arcade-card" onClick={() => { playTap(); setArcadeOpen(true) }} role="button" tabIndex={0}>
        <Gamepad2 size={24} style={{ color: 'var(--purple-2)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>NEXUS Circuit</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Offline memory game · best {state.arcadeBest} rounds</div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--purple-2)' }}>Play →</span>
      </div>

      <div className="section-title">AI Engine</div>
      <div className="glass" style={{ padding: 12, fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
        NEXUS Core · Ready
      </div>
    </div>
  )
}
