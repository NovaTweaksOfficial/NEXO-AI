import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUi } from './state/ui'
import { useSettings } from './state/settings'
import { useAuth } from './state/auth'
import { useChat } from './state/chat'
import { RobotMascot, RobotIcon } from './components/RobotMascot'
import { playNavigate } from './lib/sounds'
import { HomeView } from './views/HomeView'
import { ChatView } from './views/ChatView'
import { ToolboxView } from './views/ToolboxView'
import { HistoryView } from './views/HistoryView'
import { SettingsView } from './views/SettingsView'
import { AuthView } from './views/AuthView'
import { Home, MessageSquare, Wrench, Clock, Settings } from 'lucide-react'

const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'toolbox', label: 'Toolbox', icon: Wrench },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

function Splash() {
  return (
    <div className="page" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div className="robot-loader">
          <RobotMascot size={116} trackCursor />
        </div>
        <div className="title-gradient" style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>NEXUS AI</div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '10px 0 0' }}>
          Sorry, we're working hard to load your content. NEXUS is waking up its circuits…
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
          <RobotIcon size={14} /> Loading NEXUS Core
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { tab, setTab } = useUi()
  const { settings } = useSettings()
  const { status } = useAuth()
  const { syncNow } = useChat()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    document.documentElement.setAttribute('data-accent', settings.accent)
    document.documentElement.setAttribute('data-motion', settings.reducedMotion ? 'off' : 'on')
  }, [settings.theme, settings.accent, settings.reducedMotion])

  // Flush pending conversation changes when the app is backgrounded.
  useEffect(() => {
    const flush = () => { void syncNow() }
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [syncNow])

  if (status === 'loading') return <Splash />
  if (status === 'signedOut') return <AuthView />

  const views: Record<string, ReactNode> = {
    home: <HomeView />,
    chat: <ChatView />,
    toolbox: <ToolboxView />,
    history: <HistoryView />,
    settings: <SettingsView />,
  }

  return (
    <div className="app-shell">
      <main style={{ flex: 1, overflow: 'auto' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            style={{ height: '100%' }}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: settings.reducedMotion ? 0 : 0.22, ease: 'easeOut' }}
          >
            {views[tab]}
          </motion.div>
        </AnimatePresence>
      </main>
      <nav className="bottom-nav">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              className={`nav-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => {
                if (tab !== t.id) playNavigate()
                setTab(t.id as any)
              }}
            >
              <Icon size={22} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
