import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Clock, Code2, Command, Flame, Gamepad2, GraduationCap, Home, ImagePlus, Lightbulb,
  MessageSquare, Moon, PenLine, Plus, Search, Settings, Sparkles, Volume2, Wand2, Wrench,
  Zap, type LucideIcon,
} from 'lucide-react'
import { useUi } from '@/state/ui'
import { useSettings } from '@/state/settings'
import { useChat } from '@/state/chat'
import { useProgress } from '@/state/progress'
import { dayKey } from '@/lib/gamification'
import { playNavigate, playTap } from '@/lib/sounds'

interface Action {
  id: string
  label: string
  hint: string
  keywords: string
  icon: LucideIcon
  run: () => void
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, setTab, setMode, setArcadeOpen, setPendingTool } = useUi()
  const { settings, update } = useSettings()
  const { newConversation } = useChat()
  const { state, level, claimDaily } = useProgress()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!paletteOpen) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(timer)
  }, [paletteOpen])

  useEffect(() => { setSelected(0) }, [query, paletteOpen])

  const close = () => setPaletteOpen(false)

  const goPrompt = (text: string) => {
    sessionStorage.setItem('nexus.pendingPrompt', text)
    setTab('chat')
  }
  const goTool = (id: string) => {
    setPendingTool(id)
    setTab('toolbox')
  }
  const finish = (fn: () => void) => {
    fn()
    playNavigate()
    close()
  }

  const actions = useMemo<Action[]>(() => {
    const claimed = state.lastClaimDay === dayKey()
    const list: Action[] = [
      { id: 'new-chat', label: 'New conversation', hint: 'Start fresh', keywords: 'new chat clear reset', icon: Plus, run: () => { newConversation(); setTab('chat') } },
      { id: 'home', label: 'Go to Home', hint: 'Level, streaks, quests', keywords: 'home dashboard xp level', icon: Home, run: () => setTab('home') },
      { id: 'chat', label: 'Go to Chat', hint: 'Talk to NEXUS', keywords: 'chat message ai', icon: MessageSquare, run: () => setTab('chat') },
      { id: 'toolbox', label: 'Go to Toolbox', hint: 'All AI tools', keywords: 'tools toolbox builder', icon: Wrench, run: () => setTab('toolbox') },
      { id: 'history', label: 'Go to History', hint: 'Past conversations', keywords: 'history past chats search', icon: Clock, run: () => setTab('history') },
      { id: 'settings', label: 'Go to Settings', hint: 'Theme, sound, account', keywords: 'settings config appearance', icon: Settings, run: () => setTab('settings') },
      { id: 'image', label: 'Generate an image', hint: 'Insert /image', keywords: 'image generate picture art', icon: ImagePlus, run: () => goPrompt('/image a neon purple robot floating in space') },
      { id: 'edit', label: 'Edit a photo', hint: 'Insert /edit', keywords: 'edit photo image', icon: Wand2, run: () => goPrompt('/edit make this look like neon cyberpunk art') },
      { id: 'gif', label: 'Make an animated GIF', hint: 'Insert /gif', keywords: 'gif animated image', icon: Sparkles, run: () => goPrompt('/gif a glowing planet slowly spinning') },
      { id: 'arcade', label: 'Open NEXUS Circuit', hint: 'Offline memory game', keywords: 'arcade game fun play', icon: Gamepad2, run: () => setArcadeOpen(true) },
      { id: 'daily', label: claimed ? 'Daily bonus claimed' : 'Claim daily bonus', hint: claimed ? `Streak ${state.streak} days` : `${state.streak || 1}-day streak`, keywords: 'daily claim streak bonus reward', icon: Flame, run: claimDaily },
      { id: 'tool-mods', label: 'Build a Gorilla Tag mod', hint: 'Toolbox builder', keywords: 'gorilla tag mod menu build', icon: Code2, run: () => goTool('gorilla-tag-mods') },
      { id: 'tool-general-mods', label: 'Build a general mod', hint: 'Toolbox builder', keywords: 'mod game plugin patch build', icon: Wrench, run: () => goTool('mods-general') },
      { id: 'tool-writer', label: 'AI Writing Assistant', hint: 'Toolbox', keywords: 'write essay article', icon: PenLine, run: () => goTool('writer') },
      { id: 'tool-ideas', label: 'Idea Generator', hint: 'Toolbox', keywords: 'ideas brainstorm creative', icon: Lightbulb, run: () => goTool('ideas') },
      { id: 'tool-study', label: 'Study Assistant', hint: 'Toolbox', keywords: 'study learn tutor', icon: GraduationCap, run: () => goTool('study') },
      { id: 'mode-general', label: 'Mode: General', hint: 'Everyday questions', keywords: 'mode general', icon: MessageSquare, run: () => { setMode('general'); setTab('chat') } },
      { id: 'mode-coding', label: 'Mode: Coding', hint: 'Code and debugging', keywords: 'mode coding code', icon: Code2, run: () => { setMode('coding'); setTab('chat') } },
      { id: 'mode-creative', label: 'Mode: Creative', hint: 'Ideas and writing', keywords: 'mode creative write', icon: Sparkles, run: () => { setMode('creative'); setTab('chat') } },
      { id: 'mode-study', label: 'Mode: Study', hint: 'Learn something', keywords: 'mode study tutor', icon: GraduationCap, run: () => { setMode('study'); setTab('chat') } },
      { id: 'mode-research', label: 'Mode: Research', hint: 'Live web research', keywords: 'mode research web search', icon: Search, run: () => { setMode('research'); setTab('chat') } },
      { id: 'theme', label: 'Cycle theme', hint: `Now: ${settings.theme}`, keywords: 'theme dark midnight appearance', icon: Moon, run: () => {
        const order = ['dark', 'darker', 'midnight'] as const
        update({ theme: order[(order.indexOf(settings.theme) + 1) % order.length] })
      } },
      { id: 'sound', label: settings.soundEffects ? 'Mute interface sounds' : 'Turn on sounds', hint: 'Synced with Settings', keywords: 'sound mute audio', icon: Volume2, run: () => update({ soundEffects: !settings.soundEffects }) },
      { id: 'motion', label: settings.reducedMotion ? 'Enable animations' : 'Reduce motion', hint: 'Synced with Settings', keywords: 'motion animation accessibility', icon: Zap, run: () => update({ reducedMotion: !settings.reducedMotion }) },
    ]
    return list
  }, [state.lastClaimDay, state.streak, newConversation, setTab, setMode, setArcadeOpen, claimDaily, settings.theme, settings.soundEffects, settings.reducedMotion, update])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter(a => `${a.label} ${a.hint} ${a.keywords}`.toLowerCase().includes(q))
  }, [actions, query])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected(i => (i + 1) % Math.max(1, filtered.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected(i => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const action = filtered[selected]
      if (action) finish(action.run)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  return (
    <AnimatePresence>
      {paletteOpen && (
        <motion.div
          className="palette-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: settings.reducedMotion ? 0 : 0.15 }}
          onClick={close}
        >
          <motion.div
            className="palette-panel"
            initial={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: settings.reducedMotion ? 0 : 0.18 }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="NEXUS command palette"
          >
            <div className="palette-header">
              <Command size={17} style={{ color: 'var(--purple-2)' }} />
              <input
                ref={inputRef}
                className="palette-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search actions, tools, modes…"
                aria-label="Search commands"
              />
              <span className="palette-level">Lv {level.level}</span>
            </div>
            <div className="palette-results">
              {filtered.length === 0 && <div className="palette-empty">No commands match that.</div>}
              {filtered.map((action, index) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.id}
                    className={`palette-item ${selected === index ? 'selected' : ''}`}
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => { playTap(); finish(action.run) }}
                  >
                    <Icon size={17} style={{ color: 'var(--purple-2)', flexShrink: 0 }} />
                    <span className="palette-item-label">{action.label}</span>
                    <span className="palette-item-hint">{action.hint}</span>
                  </button>
                )
              })}
            </div>
            <div className="palette-footer">↑ ↓ to browse · Enter to run · Esc to close</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
