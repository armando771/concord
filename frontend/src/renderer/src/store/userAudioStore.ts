import { create } from 'zustand'

// Volume e "silenciar" de cada pessoa, só para mim (como no Discord) —
// guardado neste PC.

export interface UserAudio {
  /** 0–1 */
  volume: number
  muted: boolean
}

const KEY = 'concord.userAudio'
const DEFAULT: UserAudio = { volume: 1, muted: false }

function load(): Record<string, UserAudio> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, UserAudio>
  } catch {
    return {}
  }
}

function save(settings: Record<string, UserAudio>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

/** Chave do som da live (tela compartilhada) de alguém — separada da voz. */
export function streamAudioKey(userId: string): string {
  return `screen:${userId}`
}

/** Volume que de fato sai no alto-falante para essa pessoa. */
export function outputVolume(audio: UserAudio): number {
  return audio.muted ? 0 : audio.volume
}

interface UserAudioState {
  settings: Record<string, UserAudio>
  get: (userId: string) => UserAudio
  setVolume: (userId: string, volume: number) => void
  toggleMuted: (userId: string) => void
}

export const useUserAudioStore = create<UserAudioState>()((set, get) => {
  const update = (userId: string, change: Partial<UserAudio>): void => {
    const settings = { ...get().settings, [userId]: { ...get().get(userId), ...change } }
    set({ settings })
    save(settings)
  }
  return {
    settings: load(),
    get: (userId) => get().settings[userId] ?? DEFAULT,
    setVolume: (userId, volume) => update(userId, { volume: Math.min(1, Math.max(0, volume)) }),
    toggleMuted: (userId) => update(userId, { muted: !get().get(userId).muted })
  }
})
