import { useCallback, useEffect, useState } from 'react'
import { useSettings } from '@/state/settings'
import { useChat } from '@/state/chat'
import { useAuth } from '@/state/auth'
import { getAdapter } from '@/lib/providers'
import { fetchUsage, type UsageInfo } from '@/lib/api'
import { Wifi, Check, X, LogOut, UserCircle2, Cloud, Activity, RefreshCw, Zap } from 'lucide-react'

export function SettingsView() {
  const { settings, update, selectedConfig } = useSettings()
  const { clearAll, resetLocal, syncedCount, syncing } = useChat()
  const { status, user, signout, openAuth } = useAuth()
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)

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

  const testConn = async () => {
    if (!selectedConfig) {
      setTestResult({ ok: false, message: 'NEXUS Core is not configured. Set the NEXUS Cloud Endpoint below.' })
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
            <strong style={{ fontSize: 14 }}>Daily AI usage</strong>
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
              <span>{Math.round(usedPct)}% used · {usage.remaining.toLocaleString()} left</span>
              <span>Resets {resetTime} · {timeLeft}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
              ~{usage.replies} repl{usage.replies === 1 ? 'y' : 'ies'} · ~{usage.images} photo{usage.images === 1 ? '' : 's'} today · estimated
            </div>
          </>
        )}
      </div>

      {/* Unlimited replies */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} style={{ color: 'var(--purple-2)' }} />
            <div>
              <strong style={{ fontSize: 14 }}>Unlimited replies</strong>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {settings.unlimitedReplies ? 'On' : 'Off'} · {usage?.pollenConfigured ? 'server key active' : 'no server key configured'}
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!settings.unlimitedReplies}
            aria-label="Unlimited replies"
            onClick={() => update({ unlimitedReplies: !settings.unlimitedReplies })}
            style={{
              width: 44, height: 25, borderRadius: 99, border: 'none', padding: 3,
              cursor: 'pointer', flexShrink: 0,
              background: settings.unlimitedReplies ? 'var(--purple-2)' : 'rgba(255,255,255,0.16)',
              display: 'flex', alignItems: 'center',
              justifyContent: settings.unlimitedReplies ? 'flex-end' : 'flex-start',
            }}
          >
            <span style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff', display: 'block' }} />
          </button>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.6, marginTop: 10 }}>
          {settings.unlimitedReplies ? (
            usage?.pollenConfigured ? (
              <>
                No per-IP throttle — send messages back-to-back. Same engine and quality, typically{' '}
                <strong>1–3 seconds</strong> per reply (about the same as now). If the key runs out of
                credits or the service is down, NEXUS falls back automatically.
              </>
            ) : (
              <>
                Every reply goes straight to the shared Cloudflare engine. It skips the free-engine
                check, so replies can be <strong>~0.5–1 second faster</strong>, but it spends the daily
                budget — about <strong>100–140 replies</strong> before the {resetTime || 'next'} reset.
                For truly unlimited replies, add a server-side pollen key.
              </>
            )
          ) : (
            <>
              Uses the free engine first (costs nothing from the daily budget). When it is busy —
              about <strong>1 reply per 30–45 seconds</strong> — NEXUS retries on the fallback engine,
              adding roughly <strong>0.5–1.5 seconds</strong> to that reply. Turn this on to skip the check.
            </>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 8 }}>
          Applies to new messages. Photos always use vision and count toward the daily budget.
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

      {/* Cloud endpoint (advanced) */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>NEXUS Cloud Endpoint</div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
          Advanced. The secure endpoint that powers NEXUS Core. Leave the default unless you run your own deployment.
        </p>
        <input className="input" value={settings.backendUrl} onChange={e => update({ backendUrl: e.target.value })} placeholder="https://your-nexus-endpoint.workers.dev" />
      </div>

      {/* Generation settings */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Generation</div>
        <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Temperature: {settings.generation.temperature}</label>
        <input type="range" min="0" max="2" step="0.1" value={settings.generation.temperature} onChange={e => update({ generation: { ...settings.generation, temperature: parseFloat(e.target.value) } })} style={{ width: '100%' }} />
        <label style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, display: 'block' }}>Max tokens: {settings.generation.maxTokens}</label>
        <input type="range" min="64" max="4096" step="64" value={settings.generation.maxTokens} onChange={e => update({ generation: { ...settings.generation, maxTokens: parseInt(e.target.value) } })} style={{ width: '100%' }} />
        <div className="row" style={{ marginTop: 8, gap: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)' }}>Streaming</label>
          <input type="checkbox" checked={settings.generation.stream} onChange={e => update({ generation: { ...settings.generation, stream: e.target.checked } })} />
        </div>
      </div>

      {/* Theme & accent */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Appearance</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>Theme</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['dark', 'darker', 'midnight'] as const).map(t => (
            <button key={t} className={`btn ${settings.theme === t ? 'primary' : 'ghost'}`} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => update({ theme: t })}>{t}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>Accent</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['purple', 'blue', 'cyan', 'pink'] as const).map(a => (
            <button key={a} className={`btn ${settings.accent === a ? 'primary' : 'ghost'}`} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => update({ accent: a })}>{a}</button>
          ))}
        </div>
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
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Install as App (iPhone)</div>
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
          Created and owned solely by FL3SH (Cayden). No team — just one person behind NEXUS AI.
        </div>
      </div>
    </div>
  )
}
