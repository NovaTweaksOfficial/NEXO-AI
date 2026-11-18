import { useEffect, useRef, useState } from 'react'
import { useUi } from '@/state/ui'
import { useChat } from '@/state/chat'
import { useSettings } from '@/state/settings'
import { useAuth } from '@/state/auth'
import { useModeration } from '@/state/moderation'
import { useProgress } from '@/state/progress'
import { moodFrom, QUICK_REACTIONS } from '@/lib/gamification'
import { getAdapter } from '@/lib/providers'
import { NEXUS_IDENTITY } from '@/lib/identity'
import { uid } from '@/lib/storage'
import { playSend, playReceive, playError, playTap } from '@/lib/sounds'
import { RobotIcon, RobotMascot } from '@/components/RobotMascot'
import {
  compressImage,
  fetchFileObjectUrl,
  fileToDataUrl,
  readTextFile,
  uploadFile,
  createImage,
  generateTitle,
} from '@/lib/api'
import type { Attachment, ChatMessage, WebSource } from '@/types'
import {
  Send, Square, RotateCcw, Copy, Check, ChevronDown, MessageCircle, Code2, Sparkles,
  GraduationCap, Search, Camera, ImagePlus, Paperclip, X, FileText, Wand2, Film, Command,
  ExternalLink,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

const MODES = [
  { id: 'general', label: 'General', desc: 'Everyday questions', icon: MessageCircle },
  { id: 'coding', label: 'Coding', desc: 'Programming & debugging', icon: Code2 },
  { id: 'creative', label: 'Creative', desc: 'Ideas & writing', icon: Sparkles },
  { id: 'study', label: 'Study', desc: 'Learning & tutoring', icon: GraduationCap },
  { id: 'research', label: 'Research', desc: 'Research assistance', icon: Search },
] as const

const MODE_PROMPTS: Record<string, string> = {
  general: `${NEXUS_IDENTITY} Be friendly and concise.`,
  coding: `${NEXUS_IDENTITY} You are in Coding mode. Provide correct, well-explained code. Use markdown code blocks with language tags. Debug carefully.`,
  creative: `${NEXUS_IDENTITY} You are in Creative mode. Be imaginative, vivid, and inspiring.`,
  study: `${NEXUS_IDENTITY} You are in Study mode. Teach clearly, step by step, with examples and checks for understanding.`,
  research: `${NEXUS_IDENTITY} You are in Research mode. Organize information, cite reasoning, and be thorough.`,
}

const MAX_ATTACHMENTS = 4

function formatBytes(n: number): string {
  if (!n) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentImage({ att, token, backend }: { att: Attachment; token: string | null; backend: string }) {
  const [src, setSrc] = useState<string | null>(att.dataUrl || null)
  const objectUrl = useRef<string | null>(null)
  useEffect(() => {
    if (att.dataUrl || !att.fileId || !token) return
    let cancelled = false
    fetchFileObjectUrl(backend, token, att.fileId)
      .then(url => {
        if (cancelled) { URL.revokeObjectURL(url); return }
        objectUrl.current = url
        setSrc(url)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current)
        objectUrl.current = null
      }
    }
  }, [att.fileId, att.dataUrl, backend, token])
  if (!src) {
    return (
      <div style={{ width: 120, height: 90, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--text-3)' }}>
        {att.name.slice(0, 18)}
      </div>
    )
  }
  return (
    <a href={src} target="_blank" rel="noreferrer">
      <img src={src} alt={att.name} style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
    </a>
  )
}

export function ChatView() {
  const { mode, setMode, setPaletteOpen } = useUi()
  const { current, newConversation, select, addMessage, addAttachment, updateMessage, setMessageMeta, removeMessage, rename } = useChat()
  const { settings, selectedConfig: cfg } = useSettings()
  const { token } = useAuth()
  const { refresh: refreshModeration } = useModeration()
  const { state, level, award, toggleReaction } = useProgress()
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  // Honest step labels reported by the backend (and by local image work).
  const [activities, setActivities] = useState<string[]>([])
  const pushActivity = (label: string) => {
    const clean = label.trim()
    if (!clean) return
    setActivities(prev => (prev[prev.length - 1] === clean ? prev : [...prev, clean].slice(-4)))
  }
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Attachment[]>([])
  const [preparing, setPreparing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // Streaming text is committed in small batches. Updating the whole
  // conversation on every ~32-character delta made long replies stutter and
  // hammer localStorage; these refs keep the live text and the last commit.
  const streamTextRef = useRef('')
  const lastCommitRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // pending prompt from home
  const autoSendRef = useRef<string | null>(null)
  useEffect(() => {
    const p = sessionStorage.getItem('nexus.pendingPrompt')
    if (p) {
      sessionStorage.removeItem('nexus.pendingPrompt')
      setInput(p)
      autoSendRef.current = p
    }
  }, [])

  // Auto-send a home-screen suggestion once on mount. This runs after the
  // pending-prompt effect above, and send() creates the conversation itself.
  useEffect(() => {
    const p = autoSendRef.current
    if (!p) return
    autoSendRef.current = null
    void send(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [current?.messages, streaming])

  // Grow with the message instead of trapping long drafts in a one-line box.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(160, el.scrollHeight)}px`
  }, [input])

  const conv = current
  const lastAssistantId = [...(conv?.messages ?? [])].reverse().find(m => m.role === 'assistant' && m.content)?.id
  const companionMood = moodFrom(state.lastAction, level.level, state.streak)

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    setError(null)
    setPreparing(true)
    const files = Array.from(list).slice(0, MAX_ATTACHMENTS - pending.length)
    const added: Attachment[] = []
    try {
      for (const file of files) {
        if (file.size > 6_000_000) {
          setError(`${file.name} is too large (max 6 MB).`)
          continue
        }
        const isImage = file.type.startsWith('image/')
        if (isImage) {
          const { dataUrl, blob } = await compressImage(file)
          if (token) {
            const stored = await uploadFile(settings.backendUrl, token, blob, file.name.replace(/\.[^.]+$/, '') + '.jpg')
            added.push({ ...stored, kind: 'image', dataUrl, name: file.name })
          } else {
            added.push({
              id: uid(), kind: 'image', name: file.name, mime: 'image/jpeg',
              size: blob.size, dataUrl,
            })
          }
        } else if (token) {
          const stored = await uploadFile(settings.backendUrl, token, file, file.name)
          added.push({ ...stored, kind: 'file', name: file.name })
        } else if (file.type.startsWith('text/') || /\.(txt|md|csv|json|js|ts|tsx|css|html|py|sh|sql|log)$/i.test(file.name)) {
          const text = await readTextFile(file)
          added.push({
            id: uid(), kind: 'file', name: file.name, mime: file.type || 'text/plain',
            size: file.size, text,
          })
        } else {
          const dataUrl = file.size < 1_500_000 ? await fileToDataUrl(file) : undefined
          added.push({
            id: uid(), kind: 'file', name: file.name, mime: file.type || 'application/octet-stream',
            size: file.size, dataUrl,
          })
        }
      }
      setPending(prev => [...prev, ...added].slice(0, MAX_ATTACHMENTS))
    } catch (e: any) {
      if (e?.status === 403) { void refreshModeration(); return }
      setError(e?.message || 'Could not add that file.')
    } finally {
      setPreparing(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (photosRef.current) photosRef.current.value = ''
      if (filesRef.current) filesRef.current.value = ''
    }
  }

  const send = async (
    overrideText?: string,
    overrideAttachments?: Attachment[],
    historyOverride?: ChatMessage[],
  ) => {
    const attachments = overrideAttachments ?? pending
    const raw = (overrideText ?? input).trim()
    const text = raw || (attachments.length ? 'Describe what is attached.' : '')
    if (!text || streaming) return
    playSend()
    setError(null)
    setInput('')
    setPending([])
    setActivities([])
    if (attachments.length) {
      pushActivity(attachments.some(a => a.kind === 'image') ? 'read image' : 'read file')
    }
    // Uploaded images already live on the server; dropping the inline copy
    // keeps synced conversations small. Guests keep the inline data URL.
    const cleanAttachments = attachments.map(a =>
      a.kind === 'image' && a.fileId ? { ...a, dataUrl: undefined } : a,
    )
    const userMsg: ChatMessage = {
      id: uid(), role: 'user', content: text, createdAt: Date.now(),
      ...(cleanAttachments.length ? { attachments: cleanAttachments } : {}),
    }
    const assistantMsg: ChatMessage = { id: uid(), role: 'assistant', content: '', createdAt: Date.now() }

    // A conversation is created only when a real message is sent. Opening
    // chat, tapping "New", or picking a home suggestion must not leave an
    // empty conversation behind.
    const existing = conv
    const isFirst = !existing || existing.messages.length === 0
    const activeConv = existing ?? newConversation(mode)
    addMessage(activeConv.id, userMsg)
    addMessage(activeConv.id, assistantMsg)
    if (!existing || existing.messages.length === 0) {
      rename(activeConv.id, text.slice(0, 40))
    }

    // Image commands: /image <prompt>, /edit <prompt> (with a photo attached),
    // and /gif <prompt> (an animated GIF made from one generated still).
    const command = raw.match(/^\/(image|edit|gif)\s+([\s\S]+)$/i)
    if (command) {
      const kind = command[1].toLowerCase() as 'image' | 'edit' | 'gif'
      const imagePrompt = command[2].trim()
      const reference = attachments.find(a => a.kind === 'image' && (a.fileId || a.dataUrl))
      if (kind === 'edit' && !reference) {
        setError('Attach a photo first, then use /edit with what you want changed.')
        updateMessage(activeConv.id, assistantMsg.id, 'Attach a photo first, then try /edit again.')
        return
      }
      pushActivity(kind === 'edit' ? 'edit' : 'generate')
      setStreaming(true)
      setStreamingId(assistantMsg.id)
      try {
        const result = await createImage(settings.backendUrl, token, {
          prompt: imagePrompt,
          mode: kind === 'image' ? 'generate' : kind,
          ...(kind === 'edit' && reference
            ? { image: { fileId: reference.fileId, dataUrl: reference.dataUrl, mime: reference.mime } }
            : {}),
        })
        addAttachment(activeConv.id, assistantMsg.id, {
          id: uid(),
          kind: 'image',
          name: result.name,
          mime: result.mime,
          size: result.size,
          fileId: result.id,
          dataUrl: result.dataUrl,
        })
        updateMessage(
          activeConv.id,
          assistantMsg.id,
          kind === 'gif' ? "Here's your animated GIF." : "Here's your image. Want it changed? Type /edit with a photo attached.",
        )
        award(`image-${assistantMsg.id}`, kind === 'image' ? 18 : 20, {
          stats: { images: 1 },
          lastAction: 'image',
          extraTitle: kind === 'gif' ? 'Animated GIF created' : kind === 'edit' ? 'Photo edited' : 'Image created',
        })
      } catch (e: any) {
        if (e?.status === 403) { void refreshModeration(); return }
        setError(e?.message || 'Could not create that image.')
        updateMessage(activeConv.id, assistantMsg.id, `⚠️ ${e?.message || 'Could not create that image.'}`)
      } finally {
        setStreaming(false)
        setStreamingId(null)
      }
      return
    }

    const config = cfg
    if (!config) {
      updateMessage(activeConv.id, assistantMsg.id, 'NEXUS is not configured. Try again in a moment.')
      return
    }
    const adapter = getAdapter(config.provider)
    const runtimeCfg = {
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: settings.selectedModel || config.model || '',
      mode: config.mode,
      backendUrl: settings.backendUrl,
      token,
    }
    const model = runtimeCfg.model || config.model || adapter.info.defaultModels[0]

    // An explicit history is used by Regenerate: it contains the turns before
    // the regenerated prompt, so the old answer and prompt are not sent twice.
    const priorMessages = historyOverride ?? existing?.messages ?? []
    const msgs = [...priorMessages, userMsg].map(m => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt }))

    // Documents are folded into the prompt (bounded so long files can't
    // overflow the model context); images are sent as attachments for vision.
    const documents = attachments.filter(a => a.kind === 'file' && a.text)
    if (documents.length) {
      const budget = 24000
      let used = 0
      const parts: string[] = []
      for (const d of documents) {
        const room = budget - used
        if (room <= 0) break
        const slice = (d.text || '').slice(0, Math.min(12000, room))
        used += slice.length
        parts.push(`--- Attached file: ${d.name} ---\n${slice}`)
      }
      const last = msgs[msgs.length - 1]
      if (last && parts.length) last.content = `${last.content}\n\n${parts.join('\n\n')}`
    }
    const imageAttachments = cleanAttachments.filter(a => a.kind === 'image')

    pushActivity(mode === 'coding' ? 'coding' : 'write')
    setStreaming(true)
    setStreamingId(assistantMsg.id)
    streamTextRef.current = ''
    lastCommitRef.current = 0
    const ac = new AbortController()
    abortRef.current = ac
    let failed = false
    let aborted = false
    let replyText = ''
    try {
      replyText = await adapter.chat(runtimeCfg, {
        messages: msgs,
        model,
        settings: settings.generation,
        systemPrompt: MODE_PROMPTS[mode],
        signal: ac.signal,
        attachments: imageAttachments,
        fast: settings.fastReplies,
        onChunk: (full) => {
          streamTextRef.current = full
          const now = Date.now()
          if (now - lastCommitRef.current >= 120) {
            lastCommitRef.current = now
            updateMessage(activeConv.id, assistantMsg.id, full)
          }
        },
        onActivity: pushActivity,
        onSources: (sources: WebSource[]) => {
          // Only real, server-fetched URLs are stored on the reply.
          if (sources.length) setMessageMeta(activeConv.id, assistantMsg.id, { sources: sources.slice(0, 6) })
        },
      })
    } catch (e: any) {
      if (e?.status === 403) {
        failed = true
        // The safety lock is now authoritative; pull it in immediately instead
        // of waiting for the next moderation poll.
        void refreshModeration()
      } else if (e?.name === 'AbortError') {
        aborted = true
        // keep partial
      } else {
        failed = true
        const msg = e?.message || 'Request failed.'
        playError()
        setError(msg)
        updateMessage(activeConv.id, assistantMsg.id, `⚠️ ${msg}`)
      }
    } finally {
      // Commit the final text (or the partial text kept after Stop) once. The
      // throttled chunk updates above are only for smooth rendering.
      if (!failed) {
        const finalText = replyText || streamTextRef.current
        if (finalText) updateMessage(activeConv.id, assistantMsg.id, finalText)
      }
      if (!failed && !aborted) {
        playReceive()
        if (replyText.trim()) {
          const hour = new Date().getHours()
          const isNight = hour >= 22 || hour < 4
          award(`chat-${assistantMsg.id}`, 12 + (attachments.length ? 4 : 0), {
            mode,
            stats: { messages: 1, ...(isNight ? { night: 1 } : {}) },
            lastAction: 'chat',
            extraTitle: `${MODES.find(m => m.id === mode)?.label || 'General'} reply`,
          })
          // Replace the first-message placeholder with a real AI-written title.
          // It is best effort and never blocks or changes the reply.
          if (isFirst) {
            void generateTitle(
              settings.backendUrl,
              token,
              [...msgs.map(m => ({ role: m.role, content: m.content })), { role: 'assistant', content: replyText }],
            ).then(title => { if (title) rename(activeConv.id, title) })
          }
        }
      }
      setStreaming(false)
      setStreamingId(null)
      abortRef.current = null
    }
  }

  const stop = () => abortRef.current?.abort()

  const regenerate = async (assistantId: string) => {
    if (!conv || streaming) return
    const idx = conv.messages.findIndex(m => m.id === assistantId)
    if (idx < 0) return
    let userIdx = idx - 1
    while (userIdx >= 0 && conv.messages[userIdx].role !== 'user') userIdx--
    if (userIdx < 0) return
    const userMsg = conv.messages[userIdx]
    // Everything before the prompt is the true context. Pass it explicitly so
    // send() cannot reuse the stale closure that still held the old answer.
    const history = conv.messages.slice(0, userIdx)
    removeMessage(conv.id, assistantId)
    removeMessage(conv.id, userMsg.id)
    await send(userMsg.content, userMsg.attachments, history)
  }

  const copy = async (id: string, content: string) => {
    try { await navigator.clipboard.writeText(content); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500) } catch { /* */ }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 72px - var(--safe-top))', padding: 0 }}>
      {/* header */}
      <div className="glass" style={{ margin: 12, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative' }}>
          <button
            className="btn ghost"
            onClick={() => setShowModeMenu(v => !v)}
            style={{ padding: '6px 10px', gap: 6 }}
            aria-haspopup="menu"
            aria-expanded={showModeMenu}
            aria-label="Choose chat mode"
          >
            {(() => { const M = MODES.find(m => m.id === mode); const I = M?.icon; return I ? <I size={14} style={{ color: 'var(--purple-2)' }} /> : null })()}
            {MODES.find(m => m.id === mode)?.label} <ChevronDown size={14} />
          </button>
          {showModeMenu && (
            <div className="glass-strong" style={{ position: 'absolute', top: 40, left: 0, zIndex: 20, minWidth: 220, padding: 6 }}>
              {MODES.map(m => {
                const Icon = m.icon
                return (
                <button key={m.id} className="btn ghost" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', gap: 10 }}
                  onClick={() => { setMode(m.id as any); setShowModeMenu(false) }}>
                  <Icon size={16} style={{ color: 'var(--purple-2)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.desc}</div>
                  </div>
                </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="chat-level-pill">Lv {level.level}</span>
          <button className="btn ghost" style={{ padding: '6px 8px' }} onClick={() => { playTap(); setPaletteOpen(true) }} aria-label="Open command palette">
            <Command size={16} />
          </button>
          <button className="btn ghost" onClick={() => { playTap(); select(null) }} style={{ padding: '6px 10px' }}>New</button>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {(!conv || conv.messages.length === 0) && (
          <div className="empty-state">
            {settings.companion && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                <RobotMascot
                  size={86}
                  mood={companionMood}
                  trackCursor={!settings.reducedMotion}
                  speech="Ask me anything."
                />
              </div>
            )}
            <div style={{ fontSize: 18, marginBottom: 8 }}>Start a conversation</div>
            <div style={{ fontSize: 13 }}>Type a message, take a photo, or upload a file.</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
              Try <strong>/image</strong> a purple robot, <strong>/gif</strong> a neon planet, or attach a photo and use <strong>/edit</strong>.
            </div>
          </div>
        )}
        {conv?.messages.map(m => (
          <div key={m.id} style={{ display: 'flex', marginBottom: 10, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div className={`msg-bubble ${m.role === 'user' ? 'msg-user' : 'msg-assistant'}`}>
              {m.attachments && m.attachments.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: m.content ? 8 : 0 }}>
                  {m.attachments.map(a => a.kind === 'image' ? (
                    <AttachmentImage key={a.id} att={a} token={token} backend={settings.backendUrl} />
                  ) : (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', fontSize: 12 }}>
                      <FileText size={14} style={{ color: 'var(--purple-2)' }} />
                      <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                      <span style={{ color: 'var(--text-3)' }}>{formatBytes(a.size)}</span>
                    </div>
                  ))}
                </div>
              )}
              {m.role === 'assistant' ? (
                <div className={`markdown${streaming && m.id === streamingId ? ' is-streaming' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {m.content || ''}
                  </ReactMarkdown>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              )}
              {m.role === 'assistant' && !!m.sources?.length && (
                <div className="source-chips" aria-label="Live web sources">
                  <span className="source-label">Live sources</span>
                  {m.sources.map((s, i) => (
                    <a
                      key={`${s.url}-${i}`}
                      className="source-chip"
                      href={/^https?:\/\//i.test(s.url) ? s.url : '#'}
                      target="_blank"
                      rel="noreferrer"
                      title={s.snippet || s.title}
                    >
                      <ExternalLink size={10} />
                      <span>{s.title || s.url.replace(/^https?:\/\//, '').slice(0, 40)}</span>
                    </a>
                  ))}
                </div>
              )}
              {m.role === 'assistant' && m.content && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => copy(m.id, m.content)}>
                      {copiedId === m.id ? <Check size={12} /> : <Copy size={12} />} Copy
                    </button>
                    <button className="btn ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => regenerate(m.id)} disabled={streaming}>
                      <RotateCcw size={12} /> Regenerate
                    </button>
                  </div>
                  {settings.funMode && (
                    <div className="reaction-row" aria-label="React to this reply">
                      {QUICK_REACTIONS.map(emoji => {
                        const active = state.reactions[m.id] === emoji
                        return (
                          <button
                            key={emoji}
                            className={`reaction-chip ${active ? 'active' : ''}`}
                            onClick={() => toggleReaction(m.id, emoji)}
                            aria-label={`React ${emoji}`}
                            aria-pressed={active}
                          >
                            {emoji}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {!streaming && m.id === lastAssistantId && (
                    <div className="followup-row">
                      {['Make it shorter', 'Explain it simpler', 'Give me an example', 'Turn it into a list'].map(label => (
                        <button
                          key={label}
                          className="followup-chip"
                          onClick={() => send(`Using your last answer, ${label.toLowerCase()}.`)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="activity-stream" role="status" aria-live="polite">
            <span className="activity-spinner" aria-hidden="true" />
            <span className="activity-label">{activities[activities.length - 1] || 'working'}</span>
            {activities.length > 1 && (
              <span className="activity-trail">{activities.slice(0, -1).join(' → ')}</span>
            )}
          </div>
        )}
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, padding: 8 }}>{error}</div>}
      </div>

      {/* composer */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'rgba(8,8,16,0.85)', backdropFilter: 'blur(12px)' }}>
        {pending.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {pending.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', fontSize: 12 }}>
                {a.kind === 'image' && a.dataUrl
                  ? <img src={a.dataUrl} alt="" style={{ width: 26, height: 26, objectFit: 'cover', borderRadius: 6 }} />
                  : <FileText size={14} style={{ color: 'var(--purple-2)' }} />}
                <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <button className="btn ghost" style={{ padding: 2 }} onClick={() => setPending(prev => prev.filter(x => x.id !== a.id))} aria-label="Remove attachment">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 2, paddingBottom: 4 }}>
            <button className="btn ghost" style={{ padding: 8 }} title="Take a photo" aria-label="Take a photo" onClick={() => cameraRef.current?.click()} disabled={preparing || pending.length >= MAX_ATTACHMENTS}>
              <Camera size={18} />
            </button>
            <button className="btn ghost" style={{ padding: 8 }} title="Photo library" aria-label="Choose a photo" onClick={() => photosRef.current?.click()} disabled={preparing || pending.length >= MAX_ATTACHMENTS}>
              <ImagePlus size={18} />
            </button>
            <button className="btn ghost" style={{ padding: 8 }} title="Upload a file" aria-label="Upload a file" onClick={() => filesRef.current?.click()} disabled={preparing || pending.length >= MAX_ATTACHMENTS}>
              {preparing ? <RobotIcon size={18} className="spin" /> : <Paperclip size={18} />}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 2, paddingBottom: 4, paddingLeft: 6, marginLeft: 2, borderLeft: '1px solid var(--border)' }}>
            <button className="btn ghost" style={{ padding: 8 }} title="Generate an image (/image)" aria-label="Generate an image" onClick={() => { playTap(); setInput(v => `${v.trim() ? `${v.trim()} ` : ''}/image `); textareaRef.current?.focus() }} disabled={streaming}>
              <Sparkles size={18} style={{ color: 'var(--purple-2)' }} />
            </button>
            <button className="btn ghost" style={{ padding: 8 }} title="Edit attached photo (/edit)" aria-label="Edit attached photo" onClick={() => { playTap(); setInput(v => `${v.trim() ? `${v.trim()} ` : ''}/edit `); textareaRef.current?.focus() }} disabled={streaming}>
              <Wand2 size={18} style={{ color: 'var(--purple-2)' }} />
            </button>
            <button className="btn ghost" style={{ padding: 8 }} title="Make an animated GIF (/gif)" aria-label="Make an animated GIF" onClick={() => { playTap(); setInput(v => `${v.trim() ? `${v.trim()} ` : ''}/gif `); textareaRef.current?.focus() }} disabled={streaming}>
              <Film size={18} style={{ color: 'var(--purple-2)' }} />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            className="textarea"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              // Do not steal Enter while composing CJK/IME text.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
            aria-label="Message NEXUS AI"
            placeholder="Message NEXUS AI…"
            style={{ flex: 1, minHeight: 44, maxHeight: 160, overflowY: 'auto' }}
          />
          {streaming ? (
            <button className="btn danger" onClick={stop} style={{ height: 44 }}><Square size={16} /> Stop</button>
          ) : (
            <button className="btn primary" onClick={() => send()} style={{ height: 44 }}><Send size={16} /></button>
          )}
        </div>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => addFiles(e.target.files)} />
      <input ref={photosRef} type="file" accept="image/*" multiple hidden onChange={e => addFiles(e.target.files)} />
      <input ref={filesRef} type="file" multiple hidden onChange={e => addFiles(e.target.files)} />
    </div>
  )
}
