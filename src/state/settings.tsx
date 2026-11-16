import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { load, save } from '@/lib/storage'
import { DEFAULT_BACKEND } from '@/lib/api'
import { setSoundEnabled } from '@/lib/sounds'
import type { AppSettings, ProviderConfig, GenerationSettings } from '@/types'

const DEFAULT_GEN: GenerationSettings = { temperature: 0.7, maxTokens: 1024, topP: 1, stream: true }

const IS_LOCAL = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

const DEFAULT_BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL ||
  (IS_LOCAL ? 'http://localhost:8787' : DEFAULT_BACKEND)

const DEFAULT_SETTINGS: AppSettings = {
  backendUrl: DEFAULT_BACKEND_URL,
  directMode: false,
  providerConfigs: [],
  selectedConfigId: null,
  selectedModel: null,
  generation: DEFAULT_GEN,
  theme: 'dark',
  accent: 'purple',
  fontSize: 'md',
  reducedMotion: false,
  soundEffects: true,
  saveHistory: true,
  fastReplies: false,
}

interface Ctx {
  settings: AppSettings
  update: (patch: Partial<AppSettings>) => void
  addConfig: (c: ProviderConfig) => void
  updateConfig: (id: string, patch: Partial<ProviderConfig>) => void
  removeConfig: (id: string) => void
  selectedConfig: ProviderConfig | null
}

const SettingsCtx = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = load('settings', DEFAULT_SETTINGS)
    const merged: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...loaded,
      generation: { ...DEFAULT_GEN, ...(loaded.generation || {}) },
    }
    // Migration: older installs may have an empty backend URL. Always fall back
    // to the configured default so users never need to set anything up.
    if (!merged.backendUrl) merged.backendUrl = DEFAULT_BACKEND_URL
    // Rename migration: the old toggle was called "Unlimited replies".
    const legacy = load<Record<string, unknown>>('settings', {})
    if (typeof legacy.unlimitedReplies === 'boolean' && typeof legacy.fastReplies !== 'boolean') {
      merged.fastReplies = legacy.unlimitedReplies
    }
    return merged
  })
  useEffect(() => {
    save('settings', settings)
    setSoundEnabled(settings.soundEffects)
  }, [settings])

  const persist = useCallback((next: AppSettings) => {
    setSettings(next)
    save('settings', next)
  }, [])
  const update = useCallback((patch: Partial<AppSettings>) => {
    persist({ ...settings, ...patch })
  }, [settings, persist])
  const addConfig = useCallback((c: ProviderConfig) => {
    persist({ ...settings, providerConfigs: [...settings.providerConfigs, c] })
  }, [settings, persist])
  const updateConfig = useCallback((id: string, patch: Partial<ProviderConfig>) => {
    persist({ ...settings, providerConfigs: settings.providerConfigs.map(c => c.id === id ? { ...c, ...patch } : c) })
  }, [settings, persist])
  const removeConfig = useCallback((id: string) => {
    const next = settings.providerConfigs.filter(c => c.id !== id)
    persist({ ...settings, providerConfigs: next, selectedConfigId: settings.selectedConfigId === id ? (next[0]?.id ?? null) : settings.selectedConfigId })
  }, [settings, persist])

  const found = settings.providerConfigs.find(c => c.id === settings.selectedConfigId) ?? null
  // NEXUS Core always works out of the box. Requests go through the NEXUS
  // endpoint when one is configured, otherwise straight to the keyless engine
  // so static hosting (GitHub Pages) still works with zero setup.
  const selectedConfig = found ?? {
    id: 'default-backend',
    provider: 'pollinations' as any,
    label: 'NEXUS Core',
    baseUrl: '',
    mode: (settings.backendUrl ? 'backend' : 'direct') as 'backend' | 'direct',
  }

  return (
    <SettingsCtx.Provider value={{ settings, update, addConfig, updateConfig, removeConfig, selectedConfig }}>
      {children}
    </SettingsCtx.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsCtx)
  if (!ctx) throw new Error('useSettings outside provider')
  return ctx
}