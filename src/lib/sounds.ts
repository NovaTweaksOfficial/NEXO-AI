// Tiny synthesized UI sounds. No audio files, no network, works offline.
// All sound is created from oscillators so the PWA stays zero-config.

let enabled = true
let ctx: AudioContext | null = null

export function setSoundEnabled(value: boolean): void {
  enabled = !!value
}

function audio(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null
  try {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume()
      return ctx
    }
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    const created: AudioContext = new Ctor()
    ctx = created
    if (created.state === 'suspended') void created.resume()
    return created
  } catch {
    return null
  }
}

interface ToneOptions {
  type?: OscillatorType
  gain?: number
  delay?: number
  slideTo?: number
}

function tone(freq: number, duration: number, opts: ToneOptions = {}): void {
  const ac = audio()
  if (!ac) return
  const { type = 'sine', gain = 0.045, delay = 0, slideTo } = opts
  const start = ac.currentTime + delay
  const osc = ac.createOscillator()
  const vol = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration)
  vol.gain.setValueAtTime(0.0001, start)
  vol.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  vol.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(vol)
  vol.connect(ac.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

/** Soft UI tick for buttons, prompts, and toggles. */
export function playTap(): void {
  tone(560, 0.07, { type: 'triangle', gain: 0.035 })
}

/** Two-note sweep used when changing pages. */
export function playNavigate(): void {
  tone(380, 0.09, { type: 'sine', gain: 0.03 })
  tone(620, 0.11, { type: 'sine', gain: 0.028, delay: 0.055 })
}

/** Short upward chirp when a message is sent. */
export function playSend(): void {
  tone(520, 0.08, { type: 'triangle', gain: 0.032 })
  tone(880, 0.09, { type: 'sine', gain: 0.022, delay: 0.05 })
}

/** Gentle chime when a reply finishes streaming. */
export function playReceive(): void {
  tone(740, 0.13, { type: 'sine', gain: 0.028 })
  tone(1100, 0.16, { type: 'sine', gain: 0.022, delay: 0.08 })
}

/** Low pulse for errors. */
export function playError(): void {
  tone(220, 0.18, { type: 'sawtooth', gain: 0.018, slideTo: 140 })
}

/** Boot flourish for sign-in / first load. */
export function playBoot(): void {
  tone(330, 0.12, { type: 'sine', gain: 0.025 })
  tone(495, 0.14, { type: 'sine', gain: 0.025, delay: 0.1 })
  tone(660, 0.18, { type: 'sine', gain: 0.022, delay: 0.2 })
}
