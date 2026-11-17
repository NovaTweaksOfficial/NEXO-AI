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
  addAttachment: (convId: string, msgId: string, attachment: import('@/types').Attachment) => void
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

// A conversation only counts if a real message was actually sent. Older builds
// left empty rows behind locally and in D1; those are pruned on every load and
// merge so they can never show up as phantom chats.
function visible(list: Conversation[], deleted: Record<string, number>): Conversation[] {
  return list
    .filter(c => !deleted[c.id] && (c.messages?.length || 0) > 0)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const { token, isSignedIn, user } = useAuth()
  const backend = settings.backendUrl

  // Conversations and deletion tombstones are stored per identity so a shared
  // device never mixes guest chats with an account, or two accounts together.
  const guestKey = 'conversations.guest'
  const storageKey = isSignedIn && user ? `conversations.${user.id}` : guestKey
  const deletedKey = `deleted.${isSignedIn && user ? user.id : 'guest'}`

  const [deleted, setDeleted] = useState<Record<string, number>>(() => load(deletedKey, {}))
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    visible(load<Conversation[]>(storageKey, []), load<Record<string, number>>(deletedKey, {})),
  )
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncedCount, setSyncedCount] = useState(0)

  const deletedRef = useRef(deleted)
  const lastSynced = useRef<Map<string, string>>(new Map())
  const syncingRef = useRef(false)
  const deleteAttempted = useRef<Set<string>>(new Set())
  const latest = useRef(conversations)
  const loadedKey = useRef(storageKey)
  deletedRef.current = deleted
  latest.current = conversations

  // Switch storage when the signed-in identity changes. A guest's chats are
  // carried over into an account only when that account has none yet.
  useEffect(() => {
    if (loadedKey.current === storageKey) return
    const previousKey = loadedKey.current
    loadedKey.current = storageKey
    const nextDeleted = load<Record<string, number>>(deletedKey, {})
    deletedRef.current = nextDeleted
    deleteAttempted.current.clear()
    setDeleted(nextDeleted)
    let next = visible(load<Conversation[]>(storageKey, []), nextDeleted)
    if (previousKey === guestKey && next.length === 0) {
      const guestChats = visible(load<Conversation[]>(guestKey, []), nextDeleted)
      if (guestChats.length) {
        next = guestChats
        try { save(storageKey, guestChats) } catch { /* ignore */ }
      }
    }
    lastSynced.current.clear()
    setSyncedCount(0)
    setCurrentId(null)
    setConversations(next)
  }, [storageKey, deletedKey])

  // Persist whenever the list changes. Using an effect (rather than side
  // effects inside mutators) keeps every update based on the latest state.
  useEffect(() => {
    try {
      if (settings.saveHistory) save(storageKey, conversations)
      else save(storageKey, [])
    } catch { /* storage failures are non-fatal */ }
  }, [conversations, settings.saveHistory, storageKey])

  useEffect(() => {
    try { save(deletedKey, deleted) } catch { /* storage failures are non-fatal */ }
  }, [deleted, deletedKey])

  // One sync pass: retry queued deletes first, then push changed conversations.
  // Each operation is isolated so an offline failure never blocks the others.
  const syncAll = useCallback(async () => {
    if (!isSignedIn || !token || syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)
    let pushed = 0
    const doomed = deletedRef.current
    try {
      for (const id of Object.keys(doomed)) {
        if (deleteAttempted.current.has(id)) continue
        try {
          await deleteConversation(backend, token, id)
          deleteAttempted.current.add(id)
        } catch { /* offline: retry on the next sync */ }
      }
      for (const conv of latest.current) {
        if (doomed[conv.id]) continue
        const json = JSON.stringify(conv)
        if (lastSynced.current.get(conv.id) === json) continue
        try {
          await pushConversation(backend, token, conv)
          lastSynced.current.set(conv.id, json)
          pushed++
        } catch { /* offline: retry on the next sync */ }
      }
      if (pushed) setSyncedCount(lastSynced.current.size)
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [backend, isSignedIn, token])

  // Initial merge when an account is active. Tombstoned and empty remote rows
  // are filtered out and cleaned up so a deleted chat cannot be resurrected.
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
        const doomed = deletedRef.current
        for (const r of remote) {
          if (doomed[r.id] || (r.messages?.length || 0) === 0) {
            void deleteConversation(backend, token, r.id).catch(() => undefined)
          }
        }
        const remoteVisible = visible(remote, doomed)
        const baseline = new Map<string, string>()
        for (const c of remoteVisible) baseline.set(c.id, JSON.stringify(c))
        lastSynced.current = baseline
        setSyncedCount(baseline.size)
        setConversations(local => {
          const byId = new Map(visible(local, doomed).map(c => [c.id, c]))
          for (const r of remoteVisible) {
            const existing = byId.get(r.id)
            if (!existing || (r.updatedAt || 0) > (existing.updatedAt || 0)) byId.set(r.id, r)
          }
          return [...byId.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        })
      })
      .catch(() => { /* stay local-only until the server is reachable */ })
    return () => { cancelled = true }
  }, [backend, isSignedIn, token])

  // Debounced background sync (pushes and queued deletes).
  useEffect(() => {
    if (!isSignedIn || !token) return
    const timer = setTimeout(() => { void syncAll() }, 1200)
    return () => clearTimeout(timer)
  }, [conversations, deleted, isSignedIn, token, syncAll])

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

  const addAttachment = useCallback((convId: string, msgId: string, attachment: import('@/types').Attachment) => {
    setConversations(prev => prev.map(c => c.id === convId
      ? {
          ...c,
          messages: c.messages.map(m => m.id === msgId
            ? { ...m, attachments: [...(m.attachments || []), attachment] }
            : m),
          updatedAt: Date.now(),
        }
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

  // Deletions are recorded before the UI updates and survive reloads/offline
  // use. The server delete is retried on the next sync until it succeeds.
  const markDeleted = useCallback((ids: string[]) => {
    if (!ids.length) return
    const now = Date.now()
    const next = { ...deletedRef.current }
    for (const id of ids) {
      next[id] = now
      deleteAttempted.current.delete(id)
      lastSynced.current.delete(id)
    }
    deletedRef.current = next
    setDeleted(next)
  }, [])

  const remove = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id))
    setCurrentId(prev => prev === id ? null : prev)
    markDeleted([id])
  }, [markDeleted])

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
    markDeleted(doomed)
  }, [markDeleted])

  const resetLocal = useCallback(() => {
    setConversations([])
    setCurrentId(null)
    lastSynced.current.clear()
    setSyncedCount(0)
  }, [])

  const syncNow = useCallback(async () => {
    if (!isSignedIn || !token) return
    await syncAll()
  }, [isSignedIn, token, syncAll])

  const current = conversations.find(c => c.id === currentId) ?? null

  return (
    <ChatCtx.Provider value={{ conversations, currentId, current, newConversation, select, addMessage, addAttachment, updateMessage, removeMessage, rename, remove, search, clearAll, syncNow, syncing, syncedCount, resetLocal }}>
      {children}
    </ChatCtx.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatCtx)
  if (!ctx) throw new Error('useChat outside provider')
  return ctx
}
