import type { Attachment, AuthUser, Conversation } from '@/types'

export const DEFAULT_BACKEND = 'https://nexus-ai-backend.nexus-ai-backend.workers.dev'

export function normalizeBase(url: string): string {
  return (url || DEFAULT_BACKEND).replace(/\/+$/, '')
}

export function apiUrl(base: string, path: string): string {
  return `${normalizeBase(base)}${path}`
}

export class ApiError extends Error {
  status: number
  moderation?: unknown
  constructor(message: string, status: number, moderation?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.moderation = moderation
  }
}

export async function throwApiError(res: Response): Promise<never> {
  let data: any = null
  try { data = await res.json() } catch { /* non-JSON error */ }
  throw new ApiError(
    data?.error || data?.message || `Request failed (${res.status})`,
    res.status,
    data?.moderation,
  )
}

export async function apiRequest<T = any>(
  base: string,
  path: string,
  options: { method?: string; token?: string | null; body?: any } = {},
): Promise<T> {
  const res = await fetch(apiUrl(base, path), {
    method: options.method || 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) return throwApiError(res)
  return res.json()
}

// -------------------------------------------------------------- health
export async function fetchHealth(base: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(base, '/api/health')
}

// --------------------------------------------------------------- usage
export interface UsageInfo {
  day: string
  replies: number
  images: number
  neurons: number
  limit: number
  remaining: number
  resetAt: number
  estimated: boolean
  pollenConfigured: boolean
}

export async function fetchUsage(base: string): Promise<UsageInfo> {
  return apiRequest<UsageInfo>(base, '/api/usage')
}

// --------------------------------------------------------------- images
export async function createImage(
  base: string,
  token: string | null,
  options: { prompt: string; mode: 'generate' | 'edit' | 'gif'; image?: { fileId?: string; dataUrl?: string; mime?: string } },
): Promise<{ id?: string; dataUrl?: string; mime: string; size: number; name: string }> {
  return apiRequest(base, '/api/image', {
    method: 'POST',
    ...(token ? { token } : {}),
    body: options,
  })
}

// ---------------------------------------------------------- moderation
export interface Restriction {
  type: 'soft_ban' | 'ban' | 'ip_ban' | 'timeout'
  status: string
  reason: string
  expiresAt: number | null
  by: string
  pending: boolean
  target: string | null
  message: string
}

export async function fetchModerationStatus(base: string, token?: string | null) {
  return apiRequest<{ restriction: Restriction | null }>(base, '/api/moderation/status', {
    ...(token ? { token } : {}),
  })
}

// --------------------------------------------------------------- auth
export async function register(base: string, email: string, password: string) {
  return apiRequest<{ token: string; user: AuthUser }>(base, '/api/auth/register', {
    method: 'POST',
    body: { email, password },
  })
}

export async function login(base: string, email: string, password: string) {
  return apiRequest<{ token: string; user: AuthUser }>(base, '/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export async function logout(base: string, token: string) {
  return apiRequest(base, '/api/auth/logout', { method: 'POST', token })
}

export async function me(base: string, token: string) {
  return apiRequest<{ user: AuthUser }>(base, '/api/auth/me', { token })
}

// --------------------------------------------------------------- titles
/** Best-effort real-AI title for a new conversation. */
export async function generateTitle(
  base: string,
  token: string | null,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  try {
    const data = await apiRequest<{ title?: string }>(base, '/api/title', {
      method: 'POST',
      ...(token ? { token } : {}),
      body: { messages },
    })
    return typeof data?.title === 'string' ? data.title.trim().slice(0, 60) : ''
  } catch {
    return ''
  }
}

// -------------------------------------------------------- conversations
export async function fetchConversations(base: string, token: string) {
  return apiRequest<{ conversations: Conversation[] }>(base, '/api/conversations', { token })
}

export async function pushConversation(base: string, token: string, conv: Conversation) {
  return apiRequest(base, `/api/conversations/${conv.id}`, { method: 'PUT', token, body: { data: conv } })
}

export async function deleteConversation(base: string, token: string, id: string) {
  return apiRequest(base, `/api/conversations/${id}`, { method: 'DELETE', token })
}

// --------------------------------------------------------------- memory
export interface UserMemory {
  id: string
  label: string
  value: string
  updatedAt: number
}

export async function fetchMemories(base: string, token: string): Promise<{ memories: UserMemory[] }> {
  return apiRequest(base, '/api/memory', { token })
}

export async function saveMemory(base: string, token: string, label: string, value: string) {
  return apiRequest(base, '/api/memory', { method: 'POST', token, body: { label, value } })
}

export async function deleteMemory(base: string, token: string, id: string) {
  return apiRequest(base, `/api/memory/${encodeURIComponent(id)}`, { method: 'DELETE', token })
}

// ------------------------------------------------------------ progression
export interface SyncedProgress {
  xp: number
  streak: number
  longestStreak: number
  lastDay: string | null
  lastClaimDay: string | null
  stats: Record<string, number>
  achievements: Record<string, number>
  events: Record<string, boolean>
  daily: { day: string; quests: Record<string, number> }
  modes: string[]
  arcadeBest: number
  reactions: Record<string, string>
  lastAction?: string
  updatedAt: number
}

export async function fetchProgress(base: string, token: string): Promise<{ progress: SyncedProgress | null }> {
  return apiRequest(base, '/api/progress', { token })
}

export async function saveProgress(base: string, token: string, progress: SyncedProgress) {
  return apiRequest(base, '/api/progress', { method: 'PUT', token, body: { progress } })
}

// --------------------------------------------------------------- files
export async function uploadFile(
  base: string,
  token: string,
  blob: Blob,
  name: string,
): Promise<Attachment> {
  const form = new FormData()
  form.append('file', blob, name)
  const res = await fetch(apiUrl(base, '/api/files'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) return throwApiError(res)
  const data = await res.json()
  const mime = data.mime || blob.type || 'application/octet-stream'
  return {
    id: crypto.randomUUID(),
    kind: mime.startsWith('image/') ? 'image' : 'file',
    name: data.name || name,
    mime,
    size: data.size || blob.size,
    fileId: data.id,
    text: data.text,
  }
}

export async function fetchFileObjectUrl(base: string, token: string, fileId: string): Promise<string> {
  const res = await fetch(apiUrl(base, `/api/files/${fileId}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('File unavailable')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

// --------------------------------------------------------- attachments
/** Downscale an image in the browser so uploads stay small and fast. */
export async function compressImage(file: File, maxSize = 1280, quality = 0.72): Promise<{ dataUrl: string; blob: Blob }> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) {
    const dataUrl = await fileToDataUrl(file)
    return { dataUrl, blob: file }
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const dataUrl = await fileToDataUrl(file)
    return { dataUrl, blob: file }
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b || file), 'image/jpeg', quality))
  return { dataUrl, blob }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

export function readTextFile(file: File, maxChars = 20000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).slice(0, maxChars))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}
