import type { Attachment, AuthUser, Conversation } from '@/types'

export const DEFAULT_BACKEND = 'https://nexus-ai-backend.nexus-ai-backend.workers.dev'

export function normalizeBase(url: string): string {
  return (url || DEFAULT_BACKEND).replace(/\/+$/, '')
}

export function apiUrl(base: string, path: string): string {
  return `${normalizeBase(base)}${path}`
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return data?.error || data?.message || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
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
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
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
  if (!res.ok) throw new Error(await readError(res))
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
