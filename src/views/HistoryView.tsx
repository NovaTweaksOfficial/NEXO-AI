import { useState } from 'react'
import { useChat } from '@/state/chat'
import { useUi } from '@/state/ui'
import { Trash2, Edit3, MessageSquare, Download, DownloadCloud } from 'lucide-react'
import { exportAllConversations, exportConversation } from '@/lib/transcript'

export function HistoryView() {
  const { conversations, select, rename, remove, search, clearAll } = useChat()
  const { setTab } = useUi()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const list = q ? search(q) : conversations

  const open = (id: string) => {
    select(id)
    setTab('chat')
  }

  return (
    <div className="page">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>History</h2>
        {conversations.length > 0 && (
          <button
            className="btn ghost"
            style={{ fontSize: 11 }}
            onClick={() => exportAllConversations(conversations)}
            aria-label="Export all conversations as JSON"
          >
            <DownloadCloud size={14} /> Export all
          </button>
        )}
      </div>
      <input className="input" placeholder="Search conversations…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 12 }} aria-label="Search conversations" />
      {conversations.length === 0 && <div className="empty-state">No conversations yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map(c => (
          <div key={c.id} className="glass" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={18} style={{ color: 'var(--purple-2)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => open(c.id)}>
              {editing === c.id ? (
                <input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  onBlur={() => { rename(c.id, editTitle || c.title); setEditing(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') { rename(c.id, editTitle || c.title); setEditing(null) } }}
                  autoFocus />
              ) : (
                <>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.messages.length} messages · {new Date(c.updatedAt).toLocaleString()}</div>
                </>
              )}
            </div>
            <button className="btn ghost" style={{ padding: 6 }} onClick={() => exportConversation(c)} aria-label={`Export ${c.title}`}><Download size={14} /></button>
            <button className="btn ghost" style={{ padding: 6 }} onClick={() => { setEditing(c.id); setEditTitle(c.title) }} aria-label={`Rename ${c.title}`}><Edit3 size={14} /></button>
            <button className="btn ghost" style={{ padding: 6 }} onClick={() => remove(c.id)} aria-label={`Delete ${c.title}`}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      {conversations.length > 0 && (
        <button className="btn danger" style={{ marginTop: 16 }} onClick={() => { if (confirm('Delete all conversations?')) clearAll() }}>
          Clear all history
        </button>
      )}
    </div>
  )
}