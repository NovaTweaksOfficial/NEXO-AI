import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/state/auth'
import { useSettings } from '@/state/settings'
import {
  fetchOwnerDashboard,
  ownerDecision,
  ownerModerate,
  ownerRevoke,
  type Moderation,
  type OwnerDashboard,
} from '@/lib/api'
import { playTap } from '@/lib/sounds'
import { Shield, Mail, Ban, Clock, WifiOff, RefreshCw, Check, X, Trash2, AlertTriangle } from 'lucide-react'

const TYPE_LABELS: Record<Moderation['type'], string> = {
  soft_ban: 'Soft ban',
  ban: 'Ban',
  ip_ban: 'IP ban',
  timeout: 'Timeout',
}

const TYPE_ICONS: Record<Moderation['type'], typeof Ban> = {
  soft_ban: WifiOff,
  ban: Ban,
  ip_ban: Shield,
  timeout: Clock,
}

function when(ts: number | null): string {
  if (!ts) return 'never'
  return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export function OwnerView() {
  const { token, user } = useAuth()
  const { settings } = useSettings()
  const [data, setData] = useState<OwnerDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState('')
  const [type, setType] = useState<Moderation['type']>('ban')
  const [reason, setReason] = useState('')
  const [hours, setHours] = useState(24)

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      setError(null)
      setData(await fetchOwnerDashboard(settings.backendUrl, token))
    } catch (e: any) {
      setError(e?.message || 'Could not load the console.')
    }
  }, [token, settings.backendUrl])

  useEffect(() => { void refresh() }, [refresh])

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !target.trim() || reason.trim().length < 5) return
    playTap()
    void act(() => ownerModerate(settings.backendUrl, token, {
      target: target.trim(),
      type,
      reason: reason.trim(),
      hours,
    })).then(() => { setTarget(''); setReason('') })
  }

  const pending = (data?.alerts || []).filter(a => a.status === 'pending')
  const history = (data?.alerts || []).filter(a => a.status !== 'pending').slice(0, 10)
  const active = (data?.moderations || []).filter(m => m.status === 'active' || m.status === 'pending')
  const past = (data?.moderations || []).filter(m => m.status === 'revoked').slice(0, 10)

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 className="title-gradient" style={{ fontSize: 24, margin: 0, fontWeight: 800 }}>FL3SH Console</h1>
        <button className="btn ghost" onClick={() => { playTap(); void refresh() }} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 14px' }}>
        Owner controls · {user?.email}
      </p>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      {!data && !error && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading console…</div>}

      {/* AI alert inbox */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Mail size={17} style={{ color: 'var(--purple-2)' }} />
          <strong style={{ fontSize: 14 }}>AI alerts</strong>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: pending.length ? 'var(--danger)' : 'var(--text-3)' }}>
            {pending.length} awaiting review
          </span>
        </div>
        {pending.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No new alerts. NEXUS is on watch.</div>
        )}
        {pending.map(a => (
          <div key={a.id} style={{ padding: 11, borderRadius: 12, background: 'rgba(139,92,246,0.08)', border: '1px solid var(--border)', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />
              <strong style={{ fontSize: 12.5 }}>{a.title}</strong>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.55, margin: '7px 0 10px' }}>{a.detail}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn primary"
                style={{ padding: '6px 10px', fontSize: 12 }}
                disabled={busy}
                onClick={() => { playTap(); void act(() => ownerDecision(settings.backendUrl, token!, a.id, 'accept')) }}
              >
                <Check size={13} /> Accept — keep restriction
              </button>
              <button
                className="btn"
                style={{ padding: '6px 10px', fontSize: 12 }}
                disabled={busy}
                onClick={() => { playTap(); void act(() => ownerDecision(settings.backendUrl, token!, a.id, 'decline')) }}
              >
                <X size={13} /> Decline — release
              </button>
            </div>
          </div>
        ))}
        {history.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
            Reviewed: {history.map(a => `${a.title} (${a.status})`).join(' · ')}
          </div>
        )}
      </div>

      {/* New action */}
      <form className="glass" onSubmit={submit} style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Shield size={17} style={{ color: 'var(--purple-2)' }} />
          <strong style={{ fontSize: 14 }}>New moderation</strong>
        </div>
        <label style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Type</label>
        <select className="input" value={type} onChange={e => setType(e.target.value as Moderation['type'])} style={{ margin: '4px 0 10px' }}>
          {(Object.keys(TYPE_LABELS) as Moderation['type'][]).map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <label style={{ fontSize: 11.5, color: 'var(--text-2)' }}>User (email or ID){type === 'ip_ban' ? ' — or IP address' : ''}</label>
        <input
          className="input"
          value={target}
          onChange={e => setTarget(e.target.value)}
          placeholder={type === 'ip_ban' ? '1.2.3.4' : 'member@example.com'}
          list={type === 'ip_ban' ? undefined : 'owner-users'}
          style={{ margin: '4px 0 10px' }}
        />
        {type !== 'ip_ban' && (
          <datalist id="owner-users">
            {(data?.users || []).map(u => <option key={u.id} value={u.email} />)}
          </datalist>
        )}
        {type === 'timeout' && (
          <>
            <label style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Duration (hours): {hours}</label>
            <input type="range" min={1} max={720} value={hours} onChange={e => setHours(Number(e.target.value))} style={{ width: '100%', margin: '4px 0 10px' }} />
          </>
        )}
        <label style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Reason (required)</label>
        <textarea
          className="textarea"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Why are you taking this action?"
          style={{ minHeight: 64, margin: '4px 0 10px' }}
        />
        <button className="btn primary" type="submit" disabled={busy || reason.trim().length < 5 || !target.trim()} style={{ width: '100%' }}>
          <Ban size={14} /> Apply {TYPE_LABELS[type].toLowerCase()}
        </button>
      </form>

      {/* Active restrictions */}
      <div className="glass" style={{ padding: 14, marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>Active restrictions</strong>
        <div style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 10px' }}>
          {active.length} currently enforced
        </div>
        {active.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>None.</div>}
        {active.map(m => {
          const Icon = TYPE_ICONS[m.type]
          return (
            <div key={m.id} style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon size={14} style={{ color: 'var(--purple-2)' }} />
                <strong style={{ fontSize: 12.5 }}>{TYPE_LABELS[m.type]}</strong>
                <span style={{ marginLeft: 'auto', fontSize: 10.5, color: m.status === 'pending' ? 'var(--danger)' : 'var(--text-3)' }}>
                  {m.status === 'pending' ? 'awaiting your decision' : 'active'}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 6 }}>
                {m.target_email || m.ip_display || 'Unknown target'} · {m.reason}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4 }}>
                By {m.created_by} · until {when(m.expires_at)}
              </div>
              <button
                className="btn ghost"
                style={{ padding: '4px 8px', fontSize: 11.5, marginTop: 6 }}
                disabled={busy}
                onClick={() => { playTap(); void act(() => ownerRevoke(settings.backendUrl, token!, m.id)) }}
              >
                <Trash2 size={12} /> Revoke
              </button>
            </div>
          )
        })}
      </div>

      {/* Users */}
      <div className="glass" style={{ padding: 14 }}>
        <strong style={{ fontSize: 14 }}>Accounts</strong>
        <div style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 10px' }}>
          {(data?.users || []).length} registered
        </div>
        {(data?.users || []).map(u => (
          <button
            key={u.id}
            className="btn ghost"
            style={{ width: '100%', justifyContent: 'space-between', padding: '8px 6px', fontSize: 12 }}
            onClick={() => { playTap(); setTarget(u.email); setType('ban') }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</span>
            <span style={{ color: 'var(--text-3)', fontSize: 10.5 }}>{u.conversations} chats · {when(u.created_at)}</span>
          </button>
        ))}
        {past.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 10.5, color: 'var(--text-3)' }}>
            Recently revoked: {past.map(m => m.target_email || m.ip_display).join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
