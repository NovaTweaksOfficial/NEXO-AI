import type { Conversation } from '@/types'

/** Build a readable Markdown transcript from an in-app conversation. */
export function conversationToMarkdown(conv: Conversation): string {
  const lines: string[] = [
    `# ${conv.title}`,
    '',
    `Mode: ${conv.mode}  `,
    `Created: ${new Date(conv.createdAt).toLocaleString()}  `,
    `Messages: ${conv.messages.length}`,
    '',
    '---',
    '',
  ]
  for (const message of conv.messages) {
    const who = message.role === 'user' ? 'You' : message.role === 'assistant' ? 'NEXUS' : 'System'
    lines.push(`## ${who}`)
    lines.push('')
    lines.push(message.content || '(empty)')
    const attachments = message.attachments || []
    if (attachments.length) {
      lines.push('')
      lines.push(`Attachments: ${attachments.map(a => a.name).join(', ')}`)
    }
    if (message.sources?.length) {
      lines.push('')
      lines.push('Live sources:')
      for (const source of message.sources) lines.push(`- [${source.title}](${source.url})`)
    }
    lines.push('')
  }
  return lines.join('\n').trim() + '\n'
}

function safeName(name: string): string {
  return name.replace(/[^a-z0-9\-_ ]/gi, '').trim().slice(0, 60) || 'conversation'
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportConversation(conv: Conversation): void {
  downloadText(`${safeName(conv.title)}.md`, conversationToMarkdown(conv), 'text/markdown;charset=utf-8')
}

export function exportAllConversations(conversations: Conversation[]): void {
  const stamp = new Date().toISOString().slice(0, 10)
  const payload = {
    app: 'NEXUS AI',
    version: 1,
    exportedAt: new Date().toISOString(),
    conversations,
  }
  downloadText(`nexus-chats-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8')
}
