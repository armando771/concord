import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'

// Microfone e fone do painel do usuário. Por ora só estado local (a fatia de voz liga
// isso à chamada): fone mudo também silencia o microfone e, ao voltar, devolve o que estava.
const KEY = 'salinha-voice-controls'

interface Persisted {
  muted: boolean
  deafened: boolean
  mutedBeforeDeafen: boolean
}

interface VoiceControlsState extends Persisted {
  hydrate: () => Promise<void>
  toggleMute: () => Promise<void>
  toggleDeafen: () => Promise<void>
}

const DEFAULTS: Persisted = { muted: false, deafened: false, mutedBeforeDeafen: false }

const bool = (value: unknown): boolean => value === true

async function load(): Promise<Persisted> {
  try {
    const data = JSON.parse((await SecureStore.getItemAsync(KEY)) ?? 'null') as Record<string, unknown> | null
    return { muted: bool(data?.muted), deafened: bool(data?.deafened), mutedBeforeDeafen: bool(data?.mutedBeforeDeafen) }
  } catch {
    return DEFAULTS
  }
}

async function persist({ muted, deafened, mutedBeforeDeafen }: Persisted): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify({ muted, deafened, mutedBeforeDeafen }))
  } catch {
    // sem Keystore o estado só vale até fechar o app
  }
}

export const useVoiceControlsStore = create<VoiceControlsState>()((set, get) => ({
  ...DEFAULTS,
  hydrate: async () => set(await load()),
  toggleMute: async () => {
    const { muted, deafened } = get()
    // Ligar o microfone com o fone mudo também desensurdece (como no Discord).
    const next: Persisted = deafened
      ? { muted: false, deafened: false, mutedBeforeDeafen: false }
      : { ...get(), muted: !muted }
    set(next)
    await persist(next)
  },
  toggleDeafen: async () => {
    const { muted, deafened, mutedBeforeDeafen } = get()
    const next: Persisted = deafened
      ? { muted: mutedBeforeDeafen, deafened: false, mutedBeforeDeafen: false }
      : { muted: true, deafened: true, mutedBeforeDeafen: muted }
    set(next)
    await persist(next)
  }
}))
