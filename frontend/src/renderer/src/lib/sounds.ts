// Efeitos sonoros sintetizados (WebAudio) — sem arquivos de áudio.

export interface Note {
  freq: number
  /** início, em segundos */
  at: number
  duration: number
}

const tone = (freq: number, at: number, duration = 0.09): Note => ({ freq, at, duration })

export const SOUNDS = {
  join: [tone(587, 0), tone(880, 0.1, 0.14)],
  leave: [tone(880, 0), tone(587, 0.1, 0.14)],
  userJoin: [tone(660, 0, 0.07), tone(880, 0.08, 0.1)],
  userLeave: [tone(880, 0, 0.07), tone(660, 0.08, 0.1)],
  mute: [tone(520, 0, 0.06), tone(390, 0.07, 0.08)],
  unmute: [tone(390, 0, 0.06), tone(520, 0.07, 0.08)],
  deafen: [tone(440, 0, 0.07), tone(294, 0.08, 0.1)],
  undeafen: [tone(294, 0, 0.07), tone(440, 0.08, 0.1)],
  mention: [tone(988, 0, 0.12), tone(1319, 0.13, 0.22)]
} satisfies Record<string, Note[]>

export type SoundName = keyof typeof SOUNDS

const VOLUME = 0.12

let ctx: AudioContext | null = null
let outputId = ''

/** Mesma saída de áudio escolhida nas configurações ('' = padrão). */
export function setSoundOutput(deviceId: string): void {
  outputId = deviceId
  const context = ctx as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | null
  void context?.setSinkId?.(deviceId).catch(() => {})
}

export function playSound(name: SoundName): void {
  if (typeof AudioContext === 'undefined') return
  if (!ctx) {
    ctx = new AudioContext()
    if (outputId) setSoundOutput(outputId)
  }
  void ctx.resume()
  const start = ctx.currentTime + 0.01
  for (const note of SOUNDS[name]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = note.freq
    // ataque e queda curtos para não estalar
    const t0 = start + note.at
    const t1 = t0 + note.duration
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(VOLUME, t0 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t1)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t1 + 0.02)
  }
}
