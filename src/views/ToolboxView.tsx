import { useEffect, useRef, useState } from 'react'
import { useSettings } from '@/state/settings'
import { useUi } from '@/state/ui'
import { useProgress } from '@/state/progress'
import { useAuth } from '@/state/auth'
import { useModeration } from '@/state/moderation'
import { getAdapter } from '@/lib/providers'
import { NEXUS_IDENTITY } from '@/lib/identity'
import { uid } from '@/lib/storage'
import { playTap, playSend, playReceive, playError } from '@/lib/sounds'
import { Play, Copy, Check, Square, FileCode2, ChevronDown } from 'lucide-react'
import type { ToolDef } from '@/types'

interface ArtifactFile { name: string; content: string }

/** Parse the `=== filename.ext ===` format NEXUS uses for complete files. */
function parseArtifacts(text: string): { intro: string; files: ArtifactFile[] } {
  const pattern = /(?:^|\n)\s*===\s*([^\n=]+?\.[A-Za-z0-9]+)\s*===\s*\n?([\s\S]*?)(?=\n\s*===\s*[^\n=]+?\.[A-Za-z0-9]+\s*===|$)/g
  const files: ArtifactFile[] = []
  let firstIndex = -1
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    if (firstIndex < 0) firstIndex = match.index
    files.push({
      name: match[1].trim().slice(0, 120),
      content: match[2].replace(/^\n+|\n+$/g, '').slice(0, 100_000),
    })
  }
  if (!files.length) return { intro: text, files: [] }
  return { intro: text.slice(0, Math.max(0, firstIndex)).trim(), files }
}

const TOOLS: ToolDef[] = [
  {
    id: 'gorilla-tag-mods',
    name: 'Gorilla Tag Mods',
    description: 'Build BepInEx / IL2CPP mods for Gorilla Tag with C# and Unity.',
    icon: '🐒',
    systemPrompt:
      'You are a Gorilla Tag mod builder. Produce the finished mod itself, not a tutorial. ' +
      'Assume BepInEx 5.x with Il2CppInterop for an IL2CPP Unity build, C# plugins, HarmonyLib patches, and Unity 2021 LTS conventions. ' +
      'Output every file with a filename header like `=== Plugin.cs ===` followed by complete code: plugin class with [BepInPlugin], patch classes, the .csproj, and the BepInEx/plugins folder layout. ' +
      'If the user asks for a mod menu, write the working menu code now. No preamble, no "here is how", no step-by-step teaching, no placeholders, no "add your code here". ' +
      'Include real commands only where needed: a bash block for `dotnet build` and a grep line for checking BepInEx/LogOutput.log. Keep prose to one short offline-testing note at the end. ' +
      'Offline and private-lobby mods are allowed. Do not help with malware, account compromise, payment abuse, network abuse, or mods designed to harm or harass other players.',
    inputLabel: 'What mod should I build for you?',
    inputPlaceholder: 'e.g. build a BepInEx mod menu with a color toggle and a noclip toggle for private lobbies…',
    outputLabel: 'Complete mod files',
  },
  {
    id: 'mods-general',
    name: 'MODS (General)',
    description: 'Game and app modding help: Unity, C#, BepInEx, reverse engineering.',
    icon: '🛠️',
    systemPrompt:
      'You are a general mod builder. Produce the finished mod or patch, not a lesson. ' +
      'Pick the right framework (BepInEx, MelonLoader, Fabric/Forge, etc.), then output every file with a filename header like `=== Patch.cs ===` and complete C#/C++ code, plus the folder layout and project file. ' +
      'No preamble, no "here is how", no step-by-step teaching, no placeholders. If the user names a feature, implement it in code now. ' +
      'Include real bash commands only when a build step is needed and a grep line when checking logs. Keep prose to one short offline-testing note at the end. ' +
      'Offline and private-server mods are allowed. Do not help with malware, account compromise, payment abuse, mods that target other players, or network abuse.',
    inputLabel: 'What should I build for you?',
    inputPlaceholder: 'Game/app, version, engine, and the feature you want implemented…',
    outputLabel: 'Complete mod files',
  },
  { id: 'writer', name: 'AI Writing Assistant', description: 'Draft essays, articles, and content.', icon: '✍️', systemPrompt: 'You are a skilled writing assistant. Produce polished, well-structured writing based on the user request.', inputLabel: 'What should I write?', inputPlaceholder: 'Describe what you want written…', outputLabel: 'Result' },
  { id: 'summarizer', name: 'Text Summarizer', description: 'Summarize long text into key points.', icon: '📄', systemPrompt: 'Summarize the provided text concisely with key bullet points.', inputLabel: 'Text to summarize', inputPlaceholder: 'Paste text here…', outputLabel: 'Summary' },
  { id: 'code', name: 'Code Assistant', description: 'Generate or explain code.', icon: '💻', systemPrompt: 'You are a coding assistant. Generate, explain, or debug code. Use markdown code blocks.', inputLabel: 'Your coding request', inputPlaceholder: 'Describe the code you need…', outputLabel: 'Code' },
  { id: 'ideas', name: 'Idea Generator', description: 'Brainstorm creative ideas.', icon: '💡', systemPrompt: 'Brainstorm 10 creative, diverse ideas for the user topic.', inputLabel: 'Topic', inputPlaceholder: 'What do you need ideas for?', outputLabel: 'Ideas' },
  { id: 'study', name: 'Study Assistant', description: 'Explain and teach topics.', icon: '🎓', systemPrompt: 'You are a patient tutor. Explain the topic clearly with examples and a quick quiz.', inputLabel: 'Topic to learn', inputPlaceholder: 'What do you want to learn?', outputLabel: 'Lesson' },
  { id: 'rewriter', name: 'Text Rewriter', description: 'Rewrite text in a new tone.', icon: '🔄', systemPrompt: 'Rewrite the provided text improving clarity and flow. Offer a polished version.', inputLabel: 'Text to rewrite', inputPlaceholder: 'Paste text here…', outputLabel: 'Rewritten' },
  { id: 'explainer', name: 'Explanation Generator', description: 'Explain complex things simply.', icon: '🧠', systemPrompt: 'Explain the concept simply, like to a beginner, with analogies.', inputLabel: 'Concept', inputPlaceholder: 'What should I explain?', outputLabel: 'Explanation' },
  { id: 'brainstorm', name: 'Brainstorming Assistant', description: 'Expand on ideas and plans.', icon: '🚀', systemPrompt: 'Help brainstorm and expand ideas into actionable plans.', inputLabel: 'Starting idea', inputPlaceholder: 'Your idea…', outputLabel: 'Brainstorm' },
  { id: 'email', name: 'Email & Message Drafting', description: 'Draft emails and messages.', icon: '✉️', systemPrompt: 'Draft a professional, clear email/message based on the request.', inputLabel: 'What to draft', inputPlaceholder: 'Describe the email…', outputLabel: 'Draft' },
  { id: 'doc', name: 'Document Analysis', description: 'Analyze documents and text.', icon: '📑', systemPrompt: 'Analyze the provided document/text: summarize, key points, and insights.', inputLabel: 'Document text', inputPlaceholder: 'Paste document here…', outputLabel: 'Analysis' },
]

export function ToolboxView() {
  const { settings } = useSettings()
  const { pendingTool, setPendingTool } = useUi()
  const [active, setActive] = useState<string | null>(null)
  const tool = TOOLS.find(t => t.id === active)

  // Home suggestions and the command palette can open a specific tool.
  useEffect(() => {
    if (pendingTool && TOOLS.some(t => t.id === pendingTool)) {
      setActive(pendingTool)
      setPendingTool(null)
    }
  }, [pendingTool, setPendingTool])

  if (!tool) {
    return (
      <div className="page">
        <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700 }}>Toolbox</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
          {TOOLS.map(t => (
            <button key={t.id} className="glass" style={{ padding: 14, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} onClick={() => { playTap(); setActive(t.id) }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{t.icon}</div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                {settings.funMode && <span className="tool-xp">+14 XP</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{t.description}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }
  return <ToolRunner tool={tool} onBack={() => setActive(null)} />
}

function ToolRunner({ tool, onBack }: { tool: ToolDef; onBack: () => void }) {
  const { settings, selectedConfig: cfg } = useSettings()
  const { token } = useAuth()
  const { refresh: refreshModeration } = useModeration()
  const { award } = useProgress()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activities, setActivities] = useState<string[]>([])
  const pushActivity = (label: string) => {
    const clean = label.trim()
    if (!clean) return
    setActivities(prev => (prev[prev.length - 1] === clean ? prev : [...prev, clean].slice(-4)))
  }
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedFile, setCopiedFile] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const sendingRef = useRef(false)
  const lastCommitRef = useRef(0)

  const runInner = async () => {
    if (!input.trim() || loading) return
    if (!cfg) { playError(); setError('NEXUS Core is not ready. Try again in a moment.'); return }
    playSend()
    const runId = uid()
    let succeeded = false
    let partial = ''
    const ac = new AbortController()
    abortRef.current = ac
    lastCommitRef.current = 0
    setLoading(true); setError(null); setOutput('')
    setActivities([])
    pushActivity(tool.id === 'gorilla-tag-mods' || tool.id === 'mods-general' ? 'coding' : 'read')
    const adapter = getAdapter(cfg.provider)
    const runtimeCfg = {
      provider: cfg.provider,
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: settings.selectedModel || cfg.model || '',
      mode: cfg.mode,
      backendUrl: settings.backendUrl,
      token,
    }
    const isBuildTool = tool.id === 'gorilla-tag-mods' || tool.id === 'mods-general'
    const everydayGeneration = settings.efficientReplies
      ? { ...settings.generation, maxTokens: Math.min(settings.generation.maxTokens, 1024) }
      : settings.generation
    const generation = isBuildTool
      ? { ...settings.generation, maxTokens: 4096 }
      : everydayGeneration
    const systemPrompt = cfg.mode === 'backend'
      ? tool.systemPrompt
      : `${NEXUS_IDENTITY} ${tool.systemPrompt}`
    try {
      const text = await adapter.chat(runtimeCfg, {
        messages: [{ id: uid(), role: 'user', content: input, createdAt: Date.now() }],
        model: runtimeCfg.model,
        settings: generation,
        systemPrompt,
        signal: ac.signal,
        fast: settings.fastReplies,
        efficient: settings.efficientReplies,
        onChunk: (full) => {
          partial = full
          const now = Date.now()
          if (now - lastCommitRef.current >= 120) {
            lastCommitRef.current = now
            setOutput(full)
          }
        },
        onActivity: pushActivity,
      })
      setOutput(text)
      if (text.trim()) {
        succeeded = true
        award(`tool-${runId}`, 14, {
          stats: { tools: 1 },
          lastAction: 'tool',
          extraTitle: tool.name,
        })
      }
    } catch (e: any) {
      if (e?.status === 403) { void refreshModeration(); return }
      if (e?.name === 'AbortError') {
        // Keep whatever was already generated when the user pressed Stop.
        if (partial) setOutput(partial)
        return
      }
      playError()
      setError(e?.message || 'Failed.')
    } finally {
      if (succeeded) playReceive()
      setLoading(false)
      abortRef.current = null
    }
  }

  const run = async () => {
    if (sendingRef.current) return
    sendingRef.current = true
    try {
      await runInner()
    } finally {
      sendingRef.current = false
    }
  }

  const stop = () => abortRef.current?.abort()

  const copy = async () => {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  const copyFile = async (name: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedFile(name)
      setTimeout(() => setCopiedFile(null), 1500)
    } catch { /* clipboard unavailable */ }
  }

  const artifacts = parseArtifacts(output)

  return (
    <div className="page">
      <button className="btn ghost" onClick={onBack} style={{ marginBottom: 12 }}>← Back</button>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>{tool.name}</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 12 }}>{tool.description}</p>
      <div className="col">
        <label style={{ fontSize: 13, color: 'var(--text-2)' }}>{tool.inputLabel}</label>
        <textarea className="textarea" value={input} onChange={e => setInput(e.target.value)} placeholder={tool.inputPlaceholder} />
        <div className="row" style={{ alignSelf: 'flex-start', gap: 6 }}>
          <button className="btn primary" onClick={run} disabled={loading}>
            <Play size={14} /> Run
          </button>
          {loading && <button className="btn danger" onClick={stop}><Square size={13} /> Stop</button>}
        </div>
        {loading && (
          <div className="activity-stream" role="status" aria-live="polite">
            <span className="activity-spinner" aria-hidden="true" />
            <span className="activity-label">{activities[activities.length - 1] || 'working'}</span>
            {activities.length > 1 && (
              <span className="activity-trail">{activities.slice(0, -1).join(' → ')}</span>
            )}
          </div>
        )}
        {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        {output && (
          <div className="glass" style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                {tool.outputLabel}{artifacts.files.length ? ` · ${artifacts.files.length} files` : ''}
              </span>
              <button className="btn ghost" style={{ padding: 4 }} onClick={copy} aria-label="Copy all output">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            {artifacts.intro && <pre className="artifact-prose">{artifacts.intro}</pre>}
            {artifacts.files.length ? (
              <div className="artifact-list">
                {artifacts.files.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="artifact-file">
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="row" style={{ gap: 6, fontSize: 12, fontWeight: 700 }}>
                        <FileCode2 size={14} style={{ color: 'var(--purple-2)' }} /> {file.name}
                      </span>
                      <button
                        className="btn ghost"
                        style={{ padding: 3 }}
                        onClick={() => copyFile(file.name, file.content)}
                        aria-label={`Copy ${file.name}`}
                      >
                        {copiedFile === file.name ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                    <pre className="artifact-code"><code>{file.content}</code></pre>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="artifact-prose">{output}</pre>
            )}
            {artifacts.files.length > 0 && (
              <details className="artifact-raw">
                <summary><ChevronDown size={12} /> Raw response</summary>
                <pre className="artifact-prose">{output}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}