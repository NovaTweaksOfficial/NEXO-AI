import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { load, save, uid } from '@/lib/storage'
import type { Conversation, ChatMessage, AIMode } from '@/types'
import { useSettings } from './settings'
import { useAuth } from './auth'
import { deleteConversation, fetchConversations, pushConversation } from '@/lib/api'

interface Ctx {
  conversations: Conversation[]
  currentId: string | null
  current: Conversation | null
  newConversation: (mode?: AIMode) => Conversation
  select: (id: string | null) => void
  addMessage: (convId: string, msg: ChatMessage) => void
  updateMessage: (convId: string, msgId: string, content: string) => void
  removeMessage: (convId: string, msgId: string) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
  search: (q: string) => Conversation[]
  clearAll: () => void
  syncNow: () => Promise<void>
  syncing: boolean
  syncedCount: number
  resetLocal: () => void
}

const ChatCtx = createContext<Ctx | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const { token, isSignedIn, user } = useAuth()
  const backend = settings.backendUrl

  // Conversations are stored per identity so a shared device never mixes
  // guest chats with an account, or two accounts with each other.
  const guestKey = 'conversations.guest'
  const storageKey = isSignedIn && user ? `conversations.${user.id}` : guestKey
  const [conversations, setConversations] = useState<Conversation[]>(() => load(storageKey, []))
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncedCount, setSyncedCount] = useState(0)

  const lastSynced = useRef<Map<string, string>>(new Map())
  const syncingRef = useRef(false)
  const latest = useRef(conversations)
  const loadedKey = useRef(storageKey)
  latest.current = conversations

  // Switch storage when the signed-in identity changes. A guest's chats are
  // carried over into an account only when that account has none yet.
  useEffect(() => {
    if (loadedKey.current === storageKey) return
    const previousKey = loadedKey.current
    loadedKey.current = storageKey
    let next = load<Conversation[]>(storageKey, [])
    if (previousKey === guestKey && next.length === 0) {
      const guestChats = load<Conversation[]>(guestKey, [])
      if (guestChats.length) {
        next = guestChats
        try { save(storageKey, guestChats) } catch { /* ignore */ }
      }
    }
    lastSynced.current.clear()
    setSyncedCount(0)
    setCurrentId(null)
    setConversations(next)
  }, [storageKey])

  // Persist whenever the conversation list changes. Using an effect (rather
  // than side effects inside mutators) keeps every update based on the latest
  // state and avoids stale-closure overwrites.
  useEffect(() => {
    try {
      if (settings.saveHistory) save(storageKey, conversations)
      else save(storageKey, [])
    } catch { /* storage failures are non-fatal */ }
  }, [conversations, settings.saveHistory, storageKey])

  const pushDirty = useCallback(async () => {
    if (!isSignedIn || !token || syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    let pushed = 0
    try {
      for (const conv of latest.current) {
        const json = JSON.stringify(conv)
        if (lastSynced.current.get(conv.id) === json) continue
        await pushConversation(backend, token, conv)
        lastSynced.current.set(conv.id, json)
        pushed++
      }
      if (pushed) setSyncedCount(lastSynced.current.size)
    } catch { /* offline: retry on next change */ }
    syncingRef.current = false
    setSyncing(false)
  }, [backend, isSignedIn, token])

  // Initial merge when an account is active.
  useEffect(() => {
    let cancelled = false
    if (!isSignedIn || !token) {
      lastSynced.current.clear()
      setSyncedCount(0)
      return
    }
    fetchConversations(backend, token)
      .then(({ conversations: remote }) => {
        if (cancelled) return
        const baseline = new Map<string, string>()
        for (const c of remote) baseline.set(c.id, JSON.stringify(c))
        lastSynced.current = baseline
        setSyncedCount(baseline.size)
        setConversations(local => {
          const byId = new Map(local.map(c => [c.id, c]))
          for (const r of remote) {
            const existing = byId.get(r.id)
            if (!existing || (r.updatedAt || 0) > (existing.updatedAt || 0)) byId.set(r.id, r)
          }
          return [...byId.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        })
      })
      .catch(() => { /* stay local-only until server is reachable */ })
    return () => { cancelled = true }
  }, [backend, isSignedIn, token])

  // Debounced background sync.
  useEffect(() => {
    if (!isSignedIn || !token) return
    const timer = setTimeout(() => { void pushDirty() }, 1200)
    return () => clearTimeout(timer)
  }, [conversations, isSignedIn, token, pushDirty])

  const newConversation = useCallback((mode: AIMode = 'general') => {
    const conv: Conversation = {
      id: uid(),
      title: 'New conversation',
      mode,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setConversations(prev => [conv, ...prev])
    setCurrentId(conv.id)
    return conv
  }, [])

  const select = useCallback((id: string | null) => setCurrentId(id), [])

  const addMessage = useCallback((convId: string, msg: ChatMessage) => {
    setConversations(prev => prev.map(c => c.id === convId
      ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() }
      : c))
  }, [])

  const updateMessage = useCallback((convId: string, msgId: string, content: string) => {
    setConversations(prev => prev.map(c => c.id === convId
      ? { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, content } : m), updatedAt: Date.now() }
      : c))
  }, [])

  const removeMessage = useCallback((convId: string, msgId: string) => {
    setConversations(prev => prev.map(c => c.id === convId
      ? { ...c, messages: c.messages.filter(m => m.id !== msgId), updatedAt: Date.now() }
      : c))
  }, [])

  const rename = useCallback((id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title, updatedAt: Date.now() } : c))
  }, [])

  const remove = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id))
    setCurrentId(prev => prev === id ? null : prev)
    lastSynced.current.delete(id)
    if (isSignedIn && token) {
      void deleteConversation(backend, token, id).catch(() => undefined)
    }
  }, [backend, isSignedIn, token])

  const search = useCallback((q: string) => {
    const low = q.toLowerCase()
    return conversations.filter(c =>
      c.title.toLowerCase().includes(low) ||
      c.messages.some(m => m.content.toLowerCase().includes(low))
    )
  }, [conversations])

  const clearAll = useCallback(() => {
    const doomed = latest.current.map(c => c.id)
    setConversations([])
    setCurrentId(null)
    lastSynced.current.clear()
    if (isSignedIn && token) {
      for (const id of doomed) {
        void deleteConversation(backend, token, id).catch(() => undefined)
      }
    }
  }, [backend, isSignedIn, token])

  const resetLocal = useCallback(() => {
    setConversations([])
    setCurrentId(null)
    lastSynced.current.clear()
    setSyncedCount(0)
  }, [])

  const syncNow = useCallback(async () => {
    if (!isSignedIn || !token) return
    await pushDirty()
  }, [isSignedIn, token, pushDirty])

  const current = conversations.find(c => c.id === currentId) ?? null

  return (
    <ChatCtx.Provider value={{ conversations, currentId, current, newConversation, select, addMessage, updateMessage, removeMessage, rename, remove, search, clearAll, syncNow, syncing, syncedCount, resetLocal }}>
      {children}
    </ChatCtx.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatCtx)
  if (!ctx) throw new Error('useChat outside provider')
  return ctx
}
