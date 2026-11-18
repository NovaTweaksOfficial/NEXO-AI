import type { ChatMessage, GenerationSettings, ProviderId, Attachment, WebSource } from '@/types'

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
  /** Honest step labels emitted by the backend while it works. */
  onActivity?: (label: string) => void
  /** Live sources fetched by the server for this reply, when any. */
  onSources?: (sources: WebSource[]) => void
  attachments?: Attachment[]
  /** Skip the throttled free-engine check and use the direct fallback engine. */
  fast?: boolean
}

export interface ProviderAdapter {
  info: ProviderInfo
  chat(cfg: RuntimeConfig, opts: ChatOptions): Promise<string>
  listModels(cfg: RuntimeConfig): Promise<string[]>
  test(cfg: RuntimeConfig): Promise<{ ok: boolean; message: string }>
}