import { useEffect, useRef, useState } from 'react'
import { useUi } from '@/state/ui'
import { useChat } from '@/state/chat'
import { useSettings } from '@/state/settings'
import { useAuth } from '@/state/auth'
import { useModeration } from '@/state/moderation'
import { getAdapter } from '@/lib/providers'
import { NEXUS_IDENTITY } from '@/lib/identity'
import { uid } from '@/lib/storage'
import { playSend, playReceive, playError, playTap } from '@/lib/sounds'
import { RobotIcon } from '@/components/RobotMascot'
import {
  compressImage,
  fetchFileObjectUrl,
  fileToDataUrl,
  readTextFile,
  uploadFile,
  createImage,
} from '@/lib/api'
import type { Attachment, ChatMessage } from '@/types'
import {
  Send, Square, RotateCcw, Copy, Check, ChevronDown, MessageCircle, Code2, Sparkles,
  GraduationCap, Search, Camera, ImagePlus, Paperclip, X, FileText, Wand2, Film,
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
  const { mode, setMode } = useUi()
  const { current, newConversation, select, addMessage, addAttachment, updateMessage, removeMessage, rename } = useChat()
  const { settings, selectedConfig: cfg } = useSettings()
  const { token } = useAuth()
  const { refresh: refreshModeration } = useModeration()
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
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

  const conv = current

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

  const send = async (overrideText?: string, overrideAttachments?: Attachment[]) => {
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
      pushActivity(kind === 'image' ? 'generate' : 'edit')
      setStreaming(true)
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
      } catch (e: any) {
        if (e?.status === 403) { void refreshModeration(); return }
        setError(e?.message || 'Could not create that image.')
        updateMessage(activeConv.id, assistantMsg.id, `⚠️ ${e?.message || 'Could not create that image.'}`)
      } finally {
        setStreaming(false)
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

    const msgs = [...(existing?.messages ?? []), userMsg].map(m => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt }))
    const historyForModel = msgs.filter(m => m.id !== assistantMsg.id)

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
      const last = historyForModel[historyForModel.length - 1]
      if (last && parts.length) last.content = `${last.content}\n\n${parts.join('\n\n')}`
    }
    const imageAttachments = cleanAttachments.filter(a => a.kind === 'image')

    pushActivity(mode === 'coding' ? 'coding' : 'write')
    setStreaming(true)
    const ac = new AbortController()
    abortRef.current = ac
    let failed = false
    try {
      await adapter.chat(runtimeCfg, {
        messages: historyForModel,
        model,
        settings: settings.generation,
        systemPrompt: MODE_PROMPTS[mode],
        signal: ac.signal,
        attachments: imageAttachments,
        fast: settings.fastReplies,
        onChunk: (full) => updateMessage(activeConv.id, assistantMsg.id, full),
        onActivity: pushActivity,
      })
    } catch (e: any) {
      if (e?.status === 403) {
        failed = true
        // The safety lock is now authoritative; pull it in immediately instead
        // of waiting for the next moderation poll.
        void refreshModeration()
      } else if (e?.name === 'AbortError') {
        // keep partial
      } else {
        failed = true
        const msg = e?.message || 'Request failed.'
        playError()
        setError(msg)
        updateMessage(activeConv.id, assistantMsg.id, `⚠️ ${msg}`)
      }
    } finally {
      if (!failed) playReceive()
      setStreaming(false)
      abortRef.current = null
    }
  }

  const stop = () => abortRef.current?.abort()

  const regenerate = async (assistantId: string) => {
    if (!conv || streaming) return
    const idx = conv.messages.findIndex(m => m.id === assistantId)
    if (idx < 0) return
    removeMessage(conv.id, assistantId)
    let userIdx = idx - 1
    while (userIdx >= 0 && conv.messages[userIdx].role !== 'user') userIdx--
    const userMsg = userIdx >= 0 ? conv.messages[userIdx] : null
    if (!userMsg) return
    removeMessage(conv.id, userMsg.id)
    await send(userMsg.content, userMsg.attachments)
  }

  const copy = async (id: string, content: string) => {
    try { await navigator.clipboard.writeText(content); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500) } catch { /* */ }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 72px - var(--safe-top))', padding: 0 }}>
      {/* header */}
      <div className="glass" style={{ margin: 12, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative' }}>
          <button className="btn ghost" onClick={() => setShowModeMenu(v => !v)} style={{ padding: '6px 10px', gap: 6 }}>
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
        <button className="btn ghost" onClick={() => { playTap(); select(null) }} style={{ padding: '6px 10px' }}>New</button>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {(!conv || conv.messages.length === 0) && (
          <div className="empty-state">
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
                <div className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                    {m.content || ''}
                  </ReactMarkdown>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              )}
              {m.role === 'assistant' && m.content && (
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  <button className="btn ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => copy(m.id, m.content)}>
                    {copiedId === m.id ? <Check size={12} /> : <Copy size={12} />} Copy
                  </button>
                  <button className="btn ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => regenerate(m.id)} disabled={streaming}>
                    <RotateCcw size={12} /> Regenerate
                  </button>
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
            <button className="btn ghost" style={{ padding: 8 }} title="Take a photo" onClick={() => cameraRef.current?.click()} disabled={preparing || pending.length >= MAX_ATTACHMENTS}>
              <Camera size={18} />
            </button>
            <button className="btn ghost" style={{ padding: 8 }} title="Photo library" onClick={() => photosRef.current?.click()} disabled={preparing || pending.length >= MAX_ATTACHMENTS}>
              <ImagePlus size={18} />
            </button>
            <button className="btn ghost" style={{ padding: 8 }} title="Upload a file" onClick={() => filesRef.current?.click()} disabled={preparing || pending.length >= MAX_ATTACHMENTS}>
              {preparing ? <RobotIcon size={18} className="spin" /> : <Paperclip size={18} />}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 2, paddingBottom: 4, paddingLeft: 6, marginLeft: 2, borderLeft: '1px solid var(--border)' }}>
            <button className="btn ghost" style={{ padding: 8 }} title="Generate an image (/image)" onClick={() => { playTap(); setInput(v => `${v.trim() ? `${v.trim()} ` : ''}/image `); textareaRef.current?.focus() }} disabled={streaming}>
              <Sparkles size={18} style={{ color: 'var(--purple-2)' }} />
            </button>
            <button className="btn ghost" style={{ padding: 8 }} title="Edit attached photo (/edit)" onClick={() => { playTap(); setInput(v => `${v.trim() ? `${v.trim()} ` : ''}/edit `); textareaRef.current?.focus() }} disabled={streaming}>
              <Wand2 size={18} style={{ color: 'var(--purple-2)' }} />
            </button>
            <button className="btn ghost" style={{ padding: 8 }} title="Make an animated GIF (/gif)" onClick={() => { playTap(); setInput(v => `${v.trim() ? `${v.trim()} ` : ''}/gif `); textareaRef.current?.focus() }} disabled={streaming}>
              <Film size={18} style={{ color: 'var(--purple-2)' }} />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            className="textarea"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Message NEXUS AI…"
            style={{ flex: 1, minHeight: 44, maxHeight: 120 }}
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
