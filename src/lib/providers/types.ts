import type { ChatMessage, GenerationSettings, ProviderId, Attachment } from '@/types'

export interface RuntimeConfig {
  provider: ProviderId
  baseUrl?: string
  apiKey?: string
  model: string
  mode: 'backend' | 'direct'
  backendUrl?: string
  /** Session token for account-scoped backend features (file access). */
  token?: string | null
}

export interface ProviderInfo {
  id: ProviderId
  name: string
  description: string
  defaultBaseUrl: string
  requiresKey: boolean
  supportsStreaming: boolean
  supportsModelList: boolean
  defaultModels: string[]
}

export interface ChatOptions {
  messages: ChatMessage[]
  model: string
  settings: GenerationSettings
  systemPrompt?: string
  signal?: AbortSignal
  onChunk?: (text: string) => void
  attachments?: Attachment[]
}

export interface ProviderAdapter {
  info: ProviderInfo
  chat(cfg: RuntimeConfig, opts: ChatOptions): Promise<string>
  listModels(cfg: RuntimeConfig): Promise<string[]>
  test(cfg: RuntimeConfig): Promise<{ ok: boolean; message: string }>
}