// Efeitos sonoros sintetizados (WebAudio) — sem arquivos de áudio.

export interface Note {
  freq: number
  /** início, em segundos */
  at: number
  duration: number
  /** ganho no pico; sem valor, BASE_VOLUME */
  volume?: number
}

/** Volume de todos os sons, menos os que pedem outro. */
export const BASE_VOLUME = 0.12

/** Alguém entrando na call que estou: ~3× mais alto, para não passar batido. */
const USER_JOIN_VOLUME = 0.36

const tone = (freq: number, at: number, duration = 0.09, volume?: number): Note => ({
  freq,
  at,
  duration,
  ...(volume === undefined ? {} : { volume })
})

export const noteVolume = (note: Note): number => note.volume ?? BASE_VOLUME

export const SOUNDS = {
  join: [tone(587, 0), tone(880, 0.1, 0.14)],
  leave: [tone(880, 0), tone(587, 0.1, 0.14)],
  // Três notas subindo (sem sobrepor, para a soma não passar de 0,36).
  userJoin: [
    tone(660, 0, 0.07, USER_JOIN_VOLUME),
    tone(880, 0.08, 0.08, USER_JOIN_VOLUME),
    tone(1109, 0.17, 0.12, USER_JOIN_VOLUME)
  ],
  userLeave: [tone(880, 0, 0.07), tone(660, 0.08, 0.1)],
  mute: [tone(520, 0, 0.06), tone(390, 0.07, 0.08)],
  unmute: [tone(390, 0, 0.06), tone(520, 0.07, 0.08)],
  deafen: [tone(440, 0, 0.07), tone(294, 0.08, 0.1)],
  undeafen: [tone(294, 0, 0.07), tone(440, 0.08, 0.1)],
  // DM recebida: dois toques curtos subindo, mais graves que a menção.
  message: [tone(784, 0, 0.08), tone(1047, 0.09, 0.12)],
  mention: [tone(988, 0, 0.12), tone(1319, 0.13, 0.22)]
} satisfies Record<string, Note[]>

export type SoundName = keyof typeof SOUNDS

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
    gain.gain.linearRampToValueAtTime(noteVolume(note), t0 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t1)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t1 + 0.02)
  }
}
