import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUi } from './state/ui'
import { useSettings } from './state/settings'
import { useAuth } from './state/auth'
import { useChat } from './state/chat'
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
      <div style={{ textAlign: 'center' }}>
        <div className="title-gradient" style={{ fontSize: 26, fontWeight: 800 }}>NEXUS AI</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>Loading…</div>
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
