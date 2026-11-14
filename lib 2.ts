export type Role = 'user' | 'assistant';
export interface Msg {id: string; role: Role; content: string; err?: boolean}
export interface Chat {id: string; title: string; mode: string; msgs: Msg[]; ts: number}
export interface Settings {provider: string; model: string; accent: string; workerUrl: string; maxTokens: number; demo: boolean}
export const VERSION = '1.0.0';
export const MODELS: Record<string, string[]> = {
  anthropic: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro']
};
export const DEF: Settings = {provider: 'anthropic', model: MODELS.anthropic[0], accent: '#a855f7', workerUrl: '', maxTokens: 1024, demo: false};
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function load<T>(key: string, fb: T, ok: (v: unknown) => boolean): T {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return ok(v) ? (v as T) : fb; } catch { return fb; }
}
export function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full/blocked */ } }
export const validChats = (v: unknown) => Array.isArray(v) && v.every(c => c && typeof c.id === 'string' && Array.isArray(c.msgs));

export async function ask(s: Settings, system: string, messages: {role: Role; content: string}[], signal?: AbortSignal): Promise<string> {
  if (s.demo) { await new Promise(r => setTimeout(r, 700)); return '**DEMO MODE — no AI model is connected.** This canned reply exists only to preview the interface. Add your Worker URL in Settings to talk to a real model.'; }
  if (!s.workerUrl) throw new Error('Backend not configured. Open Settings and add your Worker URL.');
  const r = await fetch(s.workerUrl, {method: 'POST', headers: {'content-type': 'application/json'}, signal,
    body: JSON.stringify({provider: s.provider, model: s.model, system, messages, maxTokens: s.maxTokens})});
  const d = await r.json().catch(() => ({} as {error?: string; text?: string}));
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
  return String(d.text ?? '');
}
export async function health(url: string): Promise<Record<string, boolean> | null> {
  try { const d = await (await fetch(url)).json(); return d.ok ? d.providers : null; } catch { return null; }
}
