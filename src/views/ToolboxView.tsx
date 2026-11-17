import { useState } from 'react'
import { useSettings } from '@/state/settings'
import { useAuth } from '@/state/auth'
import { useModeration } from '@/state/moderation'
import { getAdapter } from '@/lib/providers'
import { NEXUS_IDENTITY } from '@/lib/identity'
import { uid } from '@/lib/storage'
import { playTap, playSend, playReceive, playError } from '@/lib/sounds'
import { Play, Copy, Check } from 'lucide-react'
import type { ToolDef } from '@/types'

const TOOLS: ToolDef[] = [
  {
    id: 'gorilla-tag-mods',
    name: 'Gorilla Tag Mods',
    description: 'Build BepInEx / IL2CPP mods for Gorilla Tag with C# and Unity.',
    icon: '🐒',
    systemPrompt:
      'You are a Gorilla Tag modding mentor. Help the user make real, working mods step by step. ' +
      'Assume BepInEx 5.x with Il2CppInterop for an IL2CPP Unity build, C# plugins, HarmonyLib patches, and Unity 2021 LTS conventions. ' +
      'Give a short plan first, then concrete files: plugin class with [BepInPlugin], patch classes, folder layout (BepInEx/plugins, BepInEx/patchers), and a build/test checklist. ' +
      'When a step needs commands, show real shell commands (for example dotnet build) in a bash code block, and show real grep commands for searching game logs (for example grep -i "error" BepInEx/LogOutput.log). ' +
      'Recommend testing offline or in a private lobby, keeping backups of game files, and checking the game’s current rules before using any mod online. ' +
      'Offline and private-lobby mod menus are allowed: give safe C# examples. Do not help with malware, account compromise, payment abuse, network abuse, or mods designed to harm or harass other players. ' +
      'Use markdown code blocks with language tags and explain each patch in plain language.',
    inputLabel: 'What mod are you making?',
    inputPlaceholder: 'e.g. a plugin that changes my player color, or a patch that logs room joins…',
    outputLabel: 'Mod plan & code',
  },
  {
    id: 'mods-general',
    name: 'MODS (General)',
    description: 'Game and app modding help: Unity, C#, BepInEx, reverse engineering.',
    icon: '🛠️',
    systemPrompt:
      'You are a general modding mentor. Help users make mods for games and apps: locating the right framework (BepInEx, MelonLoader, Fabric/Forge, x64dbg-style analysis), ' +
      'setting up a decompiler, reading managed or IL2CPP code, writing C#/C++ patches, hooking functions safely, and packaging a clean release. ' +
      'Start with a short plan, then give exact files, folder layout, and a build-and-test checklist. Include real shell commands in bash code blocks when a build or install step is needed, ' +
      'and real grep commands when searching logs or decompiled output. ' +
      'Stress backups, running modified builds offline first, version matching between mod and game, and respecting the software’s license and online rules. ' +
      'Offline and private-server mods are allowed: give safe examples. Do not help with malware, account compromise, payment abuse, mods that target other players, or network abuse. ' +
      'Use markdown code blocks with language tags.',
    inputLabel: 'What are you modding?',
    inputPlaceholder: 'Game/app name, version, engine, and what you want to change…',
    outputLabel: 'Mod plan & code',
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
  const [active, setActive] = useState<string | null>(null)
  const tool = TOOLS.find(t => t.id === active)

  if (!tool) {
    return (
      <div className="page">
        <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700 }}>Toolbox</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
          {TOOLS.map(t => (
            <button key={t.id} className="glass" style={{ padding: 14, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }} onClick={() => { playTap(); setActive(t.id) }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{t.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
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

  const run = async () => {
    if (!input.trim() || loading) return
    if (!cfg) { playError(); setError('No AI provider configured. Go to Settings.'); return }
    playSend()
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
    try {
      const text = await adapter.chat(runtimeCfg, {
        messages: [{ id: uid(), role: 'user', content: input, createdAt: Date.now() }],
        model: runtimeCfg.model,
        settings: settings.generation,
        systemPrompt: `${NEXUS_IDENTITY} ${tool.systemPrompt}`,
        onChunk: (full) => setOutput(full),
        onActivity: pushActivity,
      })
      if (!output) setOutput(text)
    } catch (e: any) {
      if (e?.status === 403) { void refreshModeration(); return }
      playError()
      setError(e?.message || 'Failed.')
    } finally {
      playReceive()
      setLoading(false)
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  return (
    <div className="page">
      <button className="btn ghost" onClick={onBack} style={{ marginBottom: 12 }}>← Back</button>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>{tool.name}</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 12 }}>{tool.description}</p>
      <div className="col">
        <label style={{ fontSize: 13, color: 'var(--text-2)' }}>{tool.inputLabel}</label>
        <textarea className="textarea" value={input} onChange={e => setInput(e.target.value)} placeholder={tool.inputPlaceholder} />
        <button className="btn primary" onClick={run} disabled={loading} style={{ alignSelf: 'flex-start' }}>
          <Play size={14} /> {loading ? (activities[activities.length - 1] || 'running') : 'Run'}
        </button>
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
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{tool.outputLabel}</span>
              <button className="btn ghost" style={{ padding: 4 }} onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{output}</div>
          </div>
        )}
      </div>
    </div>
  )
}