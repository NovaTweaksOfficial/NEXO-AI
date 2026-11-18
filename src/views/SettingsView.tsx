import { useCallback, useEffect, useState } from 'react'
import { useSettings } from '@/state/settings'
import { useChat } from '@/state/chat'
import { useAuth } from '@/state/auth'
import { useProgress } from '@/state/progress'
import { getAdapter } from '@/lib/providers'
import {
  fetchUsage, fetchMemories, saveMemory, deleteMemory,
  type UsageInfo, type UserMemory,
} from '@/lib/api'
import { playTap } from '@/lib/sounds'
import { RobotIcon } from '@/components/RobotMascot'
import {
  Wifi, Check, X, LogOut, UserCircle2, Cloud, Activity, RefreshCw, Zap, Volume2,
  Trophy, Flame, RotateCcw, Brain, Plus, Trash2, Gauge,
} from 'lucide-react'

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      style={{
        width: 44, height: 25, borderRadius: 99, border: 'none', padding: 3,
        cursor: 'pointer', flexShrink: 0,
        background: on ? 'var(--purple-2)' : 'rgba(255,255,255,0.16)',
        display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start',
      }}
    >
      <span style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff', display: 'block' }} />
    </button>
  )
}

export function SettingsView() {
  const { settings, update, selectedConfig } = useSettings()
  const { clearAll, resetLocal, syncedCount, syncing } = useChat()
  const { status, user, token, signout, openAuth } = useAuth()
  const { state: progress, level, synced: progressSynced, syncNow: syncProgress, reset } = useProgress()
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [memories, setMemories] = useState<UserMemory[]>([])
  const [memoryLabel, setMemoryLabel] = useState('')
  const [memoryValue, setMemoryValue] = useState('')
  const [memoryBusy, setMemoryBusy] = useState(false)
  const [memoryError, setMemoryError] = useState<string | null>(null)

  const refreshUsage = useCallback(async () => {
    try {
      setUsageError(null)
      setUsage(await fetchUsage(settings.backendUrl))
    } catch {
      setUsageError('Usage info is unavailable right now.')
    }
  }, [settings.backendUrl])

  useEffect(() => {
    void refreshUsage()
  }, [refreshUsage])

  const refreshMemories = useCallback(async () => {
    if (!token) { setMemories([]); return }
    try {
      setMemoryError(null)
      const data = await fetchMemories(settings.backendUrl, token)
      setMemories(data.memories || [])
    } catch {
      setMemoryError('Memory is unavailable right now.')
    }
  }, [settings.backendUrl, token])

  useEffect(() => {
    void refreshMemories()
  }, [refreshMemories])

  const addMemory = async () => {
    if (!token || !memoryLabel.trim() || !memoryValue.trim() || memoryBusy) return
    playTap()
    setMemoryBusy(true)
    try {
      await saveMemory(settings.backendUrl, token, memoryLabel.trim(), memoryValue.trim())
      setMemoryLabel('')
      setMemoryValue('')
      await refreshMemories()
    } catch (e: any) {
      setMemoryError(e?.message || 'Could not save that memory.')
    } finally {
      setMemoryBusy(false)
    }
  }

  const removeMemory = async (id: string) => {
    if (!token) return
    playTap()
    try {
      await deleteMemory(settings.backendUrl, token, id)
      await refreshMemories()
    } catch (e: any) {
      setMemoryError(e?.message || 'Could not remove that memory.')
    }
  }

  const testConn = async () => {
    if (!selectedConfig) {
      setTestResult({ ok: false, message: 'NEXUS Core is not available right now. Try again in a moment.' })
      return
    }
    setTesting(true); setTestResult(null)
    const adapter = getAdapter(selectedConfig.provider)
    const runtimeCfg = {
      provider: selectedConfig.provider,
      baseUrl: selectedConfig.baseUrl,
      apiKey: selectedConfig.apiKey,
      model: settings.selectedModel || selectedConfig.model || '',
      mode: selectedConfig.mode,
      backendUrl: settings.backendUrl,
    }
    const r = await adapter.test(runtimeCfg)
    setTestResult(r)
    setTesting(false)
  }

  const usedPct = usage ? Math.min(100, (usage.neurons / usage.limit) * 100) : 0
  const resetTime = usage
    ? new Date(usage.resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : ''
  const msLeft = usage ? Math.max(0, usage.resetAt - Date.now()) : 0
  const hoursLeft = Math.floor(msLeft / 3_600_000)
  const minsLeft = Math.floor((msLeft % 3_600_000) / 60_000)
  const timeLeft = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`

  return (
    <div className="page">
      <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>Settings</h2>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: 'var(--purple-2)', marginBottom: 12 }}>
        MADE BY FL3SH
      </div>

      {/* Account */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <UserCircle2 size={34} style={{ color: 'var(--purple-2)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {status === 'signedIn' ? user?.email : 'Guest'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Cloud size={12} />
              {status === 'signedIn'
                ? `${syncing ? 'Syncing…' : 'Synced'} · ${syncedCount} conversation${syncedCount === 1 ? '' : 's'} in your account`
                : 'Chats stay on this device. Sign in to sync them.'}
            </div>
          </div>
        </div>
        {status === 'signedIn' ? (
          <button
            className="btn"
            style={{ marginTop: 10 }}
            onClick={async () => {
              if (!confirm('Sign out? Your chats stay saved in your account and download again when you sign back in.')) return
              resetLocal()
              await signout()
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        ) : (
          <button className="btn primary" style={{ marginTop: 10 }} onClick={openAuth}>
            Sign in or create account
          </button>
        )}
      </div>

      {/* Daily AI usage */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} style={{ color: 'var(--purple-2)' }} />
            <strong style={{ fontSize: 14 }}>Daily usage</strong>
          </div>
          <button className="btn ghost" style={{ padding: 4 }} onClick={() => void refreshUsage()} title="Refresh usage">
            <RefreshCw size={14} />
          </button>
        </div>
        {usageError ? (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{usageError}</div>
        ) : !usage ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>Loading…</div>
        ) : (
          <>
            <div style={{ marginTop: 10, height: 8, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
              <div style={{
                height: '100%',
                width: `${usedPct}%`,
                borderRadius: 99,
                background: usedPct > 85 ? 'var(--danger, #ef4444)' : 'var(--purple-2)',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 7, fontSize: 11.5, color: 'var(--text-3)' }}>
              <span>{Math.round(usedPct)}% of included allocation used</span>
              <span>Resets {resetTime} · {timeLeft}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
              ~{usage.replies} repl{usage.replies === 1 ? 'y' : 'ies'} · ~{usage.images} photo{usage.images === 1 ? '' : 's'} today · estimate
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4 }}>
              Only replies served by the included engine count against this allocation.
            </div>
          </>
        )}
      </div>

      {/* Reply efficiency */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <Gauge size={16} style={{ color: 'var(--accent-2, var(--purple-2))' }} />
            <div>
              <strong style={{ fontSize: 14 }}>Efficient replies</strong>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {settings.efficientReplies ? 'On · recommended' : 'Off'}
              </div>
            </div>
          </div>
          <Toggle
            label="Efficient replies"
            on={!!settings.efficientReplies}
            onChange={() => { playTap(); update({ efficientReplies: !settings.efficientReplies }) }}
          />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.6, marginTop: 10 }}>
          Everyday chats use a shorter instruction set, tighter recent context, fewer extra web fetches,
          and one concise title call. This spends fewer tokens without changing the AI or faking replies.
          Finished builds still get full files and the room they need.
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 8 }}>
          Photos still use real vision and count toward the included allocation.
        </div>
      </div>

      {/* Fast replies */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <Zap size={16} style={{ color: 'var(--accent-2, var(--purple-2))' }} />
            <div>
              <strong style={{ fontSize: 14 }}>Fast replies</strong>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {settings.fastReplies ? 'On' : 'Off'}
              </div>
            </div>
          </div>
          <Toggle
            label="Fast replies"
            on={!!settings.fastReplies}
            onChange={() => { playTap(); update({ fastReplies: !settings.fastReplies }) }}
          />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.6, marginTop: 10 }}>
          {settings.fastReplies ? (
            'NEXUS skips the initial availability check and goes straight to the always-ready route. Same replies, less waiting.'
          ) : (
            'NEXUS first tries the free route, then retries automatically if it is busy. That can add a moment to a reply.'
          )}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 8 }}>
          Text messages only. Photos and file uploads still count toward the included allocation.
        </div>
      </div>

      {/* AI Engine */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontWeight: 600 }}>NEXUS Core</div>
          <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            Ready
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 10px' }}>
          NEXUS Core is included and ready to use. No account, setup, or API key required.
        </p>
        <button className="btn" onClick={testConn} disabled={testing}>
          <Wifi size={14} /> {testing ? 'Checking…' : 'Check connection'}
        </button>
        {testResult && (
          <div style={{ marginTop: 8, fontSize: 13, color: testResult.ok ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {testResult.ok ? <Check size={14} /> : <X size={14} />}
            {testResult.ok ? 'NEXUS Core is online.' : 'NEXUS Core is temporarily unavailable.'}
          </div>
        )}
      </div>

      {/* Generation settings */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Generation</div>
        <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Temperature: {settings.generation.temperature}</label>
        <input type="range" min="0" max="2" step="0.1" value={settings.generation.temperature} onChange={e => update({ generation: { ...settings.generation, temperature: parseFloat(e.target.value) } })} style={{ width: '100%' }} />
        <label style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, display: 'block' }}>
          Everyday reply cap: {settings.efficientReplies ? Math.min(settings.generation.maxTokens, 1024) : settings.generation.maxTokens}
        </label>
        <input type="range" min="256" max="4096" step="64" value={settings.generation.maxTokens} onChange={e => update({ generation: { ...settings.generation, maxTokens: parseInt(e.target.value) } })} style={{ width: '100%' }} />
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4 }}>
          Finished builds automatically get a larger cap.
        </div>
        <div className="row" style={{ marginTop: 8, gap: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Streaming</label>
          <input type="checkbox" checked={settings.generation.stream} onChange={e => update({ generation: { ...settings.generation, stream: e.target.checked } })} />
        </div>
      </div>

      {/* Appearance */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Appearance</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>Theme</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['dark', 'darker', 'midnight'] as const).map(t => (
            <button key={t} className={`btn ${settings.theme === t ? 'primary' : 'ghost'}`} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => update({ theme: t })}>{t}</button>
          ))}
        </div>
      </div>

      {/* Experience */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Experience</div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Volume2 size={15} style={{ color: 'var(--purple-2)' }} />
            <div>
              <div style={{ fontSize: 12.5 }}>Interface sounds</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Tiny synthesized clicks, sends, and reply chimes</div>
            </div>
          </div>
          <Toggle
            label="Interface sounds"
            on={!!settings.soundEffects}
            onChange={() => { playTap(); update({ soundEffects: !settings.soundEffects }) }}
          />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 12.5 }}>Reduced motion</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Turns off page transitions and robot tracking</div>
          </div>
          <Toggle
            label="Reduced motion"
            on={!!settings.reducedMotion}
            onChange={() => { playTap(); update({ reducedMotion: !settings.reducedMotion }) }}
          />
        </div>
      </div>

      {/* Fun & progress */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <Trophy size={16} style={{ color: 'var(--purple-2)' }} />
          <strong style={{ fontSize: 14 }}>Fun & progress</strong>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '6px 0 10px', lineHeight: 1.5 }}>
          {status === 'signedIn'
            ? 'XP, streaks, badges, quests, and message stickers are saved to your account, so they follow you to every device.'
            : 'Guests keep XP, streaks, badges, quests, and stickers on this device only. Sign in to sync them across devices.'}
        </div>
        {status === 'signedIn' && (
          <div className="row" style={{ gap: 8, margin: '0 0 12px' }}>
            <Cloud size={13} style={{ color: progressSynced ? 'var(--success)' : 'var(--text-3)' }} />
            <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
              {progressSynced ? 'Account sync active' : 'Syncing with your account…'}
            </span>
            <button
              className="btn ghost"
              style={{ marginLeft: 'auto', padding: '4px 9px', fontSize: 10.5 }}
              onClick={() => { playTap(); void syncProgress() }}
            >
              <RefreshCw size={12} /> Sync now
            </button>
          </div>
        )}
        <div className="home-stats" style={{ marginBottom: 12 }}>
          <div><strong>{level.level}</strong><span>level</span></div>
          <div><strong>{progress.xp}</strong><span>XP</span></div>
          <div><strong>{progress.streak}</strong><span>streak</span></div>
          <div><strong>{Object.keys(progress.achievements).length}</strong><span>badges</span></div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <div className="row" style={{ gap: 8 }}>
            <Zap size={15} style={{ color: 'var(--purple-2)' }} />
            <div>
              <div style={{ fontSize: 12.5 }}>Fun progress</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>XP, quests, badges, and celebrations</div>
            </div>
          </div>
          <Toggle
            label="Fun progress"
            on={!!settings.funMode}
            onChange={() => { playTap(); update({ funMode: !settings.funMode }) }}
          />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
          <div className="row" style={{ gap: 8 }}>
            <Flame size={15} style={{ color: 'var(--purple-2)' }} />
            <div>
              <div style={{ fontSize: 12.5 }}>NEXUS companion</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Clickable robot with moods and speech</div>
            </div>
          </div>
          <Toggle
            label="NEXUS companion"
            on={!!settings.companion}
            onChange={() => { playTap(); update({ companion: !settings.companion }) }}
          />
        </div>
        <button
          className="btn danger"
          style={{ marginTop: 12 }}
          onClick={() => {
            if (confirm(status === 'signedIn'
              ? 'Reset XP, streaks, badges, quests, and stickers on this account across all devices? Your chats are not affected.'
              : 'Reset local XP, streaks, badges, quests, and stickers? Your chats are not affected.')) {
              playTap()
              reset()
            }
          }}
        >
          <RotateCcw size={14} /> Reset progress
        </button>
      </div>

      {/* NEXUS Memory */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <Brain size={16} style={{ color: 'var(--purple-2)' }} />
          <strong style={{ fontSize: 14 }}>NEXUS Memory</strong>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '6px 0 10px', lineHeight: 1.5 }}>
          {status === 'signedIn'
            ? 'Save facts you want NEXUS to remember. Stored on your account and sent as context only when relevant. Nothing is inferred from private chats.'
            : 'Sign in to give NEXUS durable memory. Guests keep chats on this device only.'}
        </div>
        {status === 'signedIn' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="input"
                value={memoryLabel}
                onChange={e => setMemoryLabel(e.target.value)}
                placeholder="Short name, e.g. Timezone"
                maxLength={60}
                aria-label="Memory name"
              />
              <textarea
                className="textarea"
                value={memoryValue}
                onChange={e => setMemoryValue(e.target.value)}
                placeholder="Detail, e.g. I am in Central time"
                rows={2}
                maxLength={800}
                aria-label="Memory detail"
              />
              <button
                className="btn primary"
                disabled={memoryBusy || !memoryLabel.trim() || !memoryValue.trim()}
                onClick={() => void addMemory()}
              >
                <Plus size={14} /> {memoryBusy ? 'Saving…' : 'Save memory'}
              </button>
            </div>
            {memoryError && <div style={{ color: 'var(--danger)', fontSize: 11.5, marginTop: 8 }}>{memoryError}</div>}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {memories.length === 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>No memories saved yet.</div>
              )}
              {memories.map(m => (
                <div key={m.id} className="memory-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {m.value}
                    </div>
                  </div>
                  <button
                    className="btn ghost"
                    style={{ padding: 6 }}
                    onClick={() => void removeMemory(m.id)}
                    aria-label={`Remove ${m.label}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Privacy */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Privacy & Data</div>
        <div className="row" style={{ gap: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Save chat history locally</label>
          <input type="checkbox" checked={settings.saveHistory} onChange={e => update({ saveHistory: e.target.checked })} />
        </div>
        <button className="btn danger" style={{ marginTop: 10 }} onClick={() => { if (confirm('Clear all conversations?')) clearAll() }}>Clear all history</button>
      </div>

      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotIcon size={20} /> Install NEXUS AI on your device
        </div>
        <ol style={{ fontSize: 12, color: 'var(--text-2)', paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
          <li>Open this site in Safari.</li>
          <li>Tap the Share button.</li>
          <li>Choose "Add to Home Screen".</li>
          <li>Launch NEXUS AI from your Home Screen.</li>
        </ol>
      </div>

      <div className="glass" style={{ padding: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>About NEXUS AI</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          MADE BY FL3SH · Version 1.0.0 · NEXUS Core engine.
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
          Created and owned solely by FL3SH (r00ster). No team — just one person behind NEXUS AI.
        </div>
      </div>
    </div>
  )
}
