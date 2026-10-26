import { create } from 'zustand'
import type { WsEvent } from '../../../shared/api/ws'
import {
  deleteServerSound,
  listServerSounds,
  uploadServerSound,
  type SoundboardItem,
  type UploadSoundboardInput
} from '../api/soundboard'
import {
  playSoundboardClip,
  setActiveSoundboardVolume,
  stopAllSoundboardAudio
} from '../lib/soundboardPlayer'
import { useCallStore, type CallUserInfo } from './callStore'
import { useChatStore } from '../../chat/store/chatStore'
import { showToast } from '../../../shared/store/toastStore'
import { useUserAudioStore } from './userAudioStore'

const STORAGE_KEY = 'concord:soundboard-prefs'
const DEFAULT_VOLUME = 0.8

export interface SoundboardPrefs {
  volume: number
  favorites: string[]
  keybinds: Record<string, string>
}

export interface ActiveSoundPlay {
  soundId: string
  soundName: string
  emoji?: string | null
  playToken: number
}

interface CallSoundboardPayload {
  call_id: string
  sound: {
    id: string
    server_id: string
    name: string
    emoji?: string | null
    duration_ms: number
  }
  user: CallUserInfo
}

interface SoundboardCreatedPayload {
  server_id: string
  sound: SoundboardItem
}

interface SoundboardDeletedPayload {
  server_id: string
  sound_id: string
}

function loadPrefs(): SoundboardPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { volume: DEFAULT_VOLUME, favorites: [], keybinds: {} }
    const parsed = JSON.parse(raw) as Partial<SoundboardPrefs>
    const volume =
      typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
        ? Math.max(0, Math.min(1, parsed.volume))
        : DEFAULT_VOLUME
    const favorites = Array.isArray(parsed.favorites)
      ? parsed.favorites.filter((x): x is string => typeof x === 'string')
      : []
    const keybinds =
      parsed.keybinds && typeof parsed.keybinds === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.keybinds).filter(
              ([k, v]) => typeof k === 'string' && typeof v === 'string' && v.trim() !== ''
            )
          )
        : {}
    return { volume, favorites, keybinds }
  } catch {
    return { volume: DEFAULT_VOLUME, favorites: [], keybinds: {} }
  }
}

function savePrefs(prefs: SoundboardPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage indisponível
  }
}

let nextPlayToken = 1
const playTimers = new Map<string, ReturnType<typeof setTimeout>>()

interface SoundboardState {
  volume: number
  favorites: string[]
  keybinds: Record<string, string>
  soundsByServer: Record<string, SoundboardItem[]>
  loadingByServer: Record<string, boolean>
  /** userId -> som sendo reproduzido agora na chamada ativa */
  activePlays: Record<string, ActiveSoundPlay>

  setVolume: (volume: number) => void
  toggleFavorite: (soundId: string) => void
  setKeybind: (soundId: string, keybind: string | null) => void
  loadServerSounds: (serverId: string) => Promise<void>
  uploadSound: (
    serverId: string,
    file: Blob,
    input: UploadSoundboardInput
  ) => Promise<SoundboardItem>
  deleteSound: (serverId: string, soundId: string) => Promise<void>
  triggerSound: (soundId: string) => void
  clearActivePlays: () => void
  handleWsEvent: (event: WsEvent) => void
}

const initialPrefs = loadPrefs()

export const useSoundboardStore = create<SoundboardState>()((set, get) => {
  const clearUserPlay = (userId: string, token: number): void => {
    const current = get().activePlays[userId]
    if (!current || current.playToken !== token) return
    const timer = playTimers.get(userId)
    if (timer) {
      clearTimeout(timer)
      playTimers.delete(userId)
    }
    set((s) => {
      if (s.activePlays[userId]?.playToken !== token) return s
      const next = { ...s.activePlays }
      delete next[userId]
      return { activePlays: next }
    })
  }

  return {
    volume: initialPrefs.volume,
    favorites: initialPrefs.favorites,
    keybinds: initialPrefs.keybinds,
    soundsByServer: {},
    loadingByServer: {},
    activePlays: {},

    setVolume: (volume) => {
      const clamped = Math.max(0, Math.min(1, volume))
      set({ volume: clamped })
      setActiveSoundboardVolume(clamped)
      const { favorites, keybinds } = get()
      savePrefs({ volume: clamped, favorites, keybinds })
    },

    toggleFavorite: (soundId) => {
      set((s) => {
        const exists = s.favorites.includes(soundId)
        const favorites = exists
          ? s.favorites.filter((id) => id !== soundId)
          : [...s.favorites, soundId]
        savePrefs({ volume: s.volume, favorites, keybinds: s.keybinds })
        return { favorites }
      })
    },

    setKeybind: (soundId, keybind) => {
      set((s) => {
        const nextKeybinds = { ...s.keybinds }
        const normalized = keybind?.trim() ?? ''
        if (!normalized) {
          delete nextKeybinds[soundId]
        } else {
          // Remove o mesmo atalho de outro som para evitar conflito
          for (const [otherId, kb] of Object.entries(nextKeybinds)) {
            if (kb.toLowerCase() === normalized.toLowerCase()) {
              delete nextKeybinds[otherId]
            }
          }
          nextKeybinds[soundId] = normalized
        }
        savePrefs({ volume: s.volume, favorites: s.favorites, keybinds: nextKeybinds })
        return { keybinds: nextKeybinds }
      })
    },

    loadServerSounds: async (serverId) => {
      if (!serverId) return
      set((s) => ({ loadingByServer: { ...s.loadingByServer, [serverId]: true } }))
      try {
        const list = await listServerSounds(serverId)
        set((s) => ({
          soundsByServer: {
            ...s.soundsByServer,
            [serverId]: Array.isArray(list) ? list : []
          }
        }))
      } catch {
        // falha silenciosa; o usuário pode tentar abrir de novo
      } finally {
        set((s) => ({ loadingByServer: { ...s.loadingByServer, [serverId]: false } }))
      }
    },

    uploadSound: async (serverId, file, input) => {
      const created = await uploadServerSound(serverId, file, input)
      set((s) => {
        const current = s.soundsByServer[serverId] ?? []
        if (current.some((x) => x.id === created.id)) return s
        return {
          soundsByServer: {
            ...s.soundsByServer,
            [serverId]: [created, ...current]
          }
        }
      })
      return created
    },

    deleteSound: async (serverId, soundId) => {
      await deleteServerSound(serverId, soundId)
      set((s) => {
        const current = s.soundsByServer[serverId] ?? []
        return {
          soundsByServer: {
            ...s.soundsByServer,
            [serverId]: current.filter((x) => x.id !== soundId)
          }
        }
      })
    },

    triggerSound: (soundId) => {
      const { status, type, callId, muted, deafened } = useCallStore.getState()
      if (status !== 'active' || type !== 'channel' || !callId) {
        showToast.error('Entre em um canal de voz do servidor para usar a mesa de áudio.')
        return
      }
      if (muted || deafened) {
        showToast.info('Desative o mudo para tocar áudios na chamada.')
        return
      }
      useChatStore.getState().sendEvent('call:soundboard', {
        call_id: callId,
        sound_id: soundId
      })
    },

    clearActivePlays: () => {
      playTimers.forEach((timer) => clearTimeout(timer))
      playTimers.clear()
      stopAllSoundboardAudio()
      set({ activePlays: {} })
    },

    handleWsEvent: (event) => {
      if (event.type === 'soundboard:created') {
        const p = event.payload as SoundboardCreatedPayload
        if (!p?.server_id || !p?.sound) return
        set((s) => {
          const current = s.soundsByServer[p.server_id] ?? []
          if (current.some((x) => x.id === p.sound.id)) return s
          return {
            soundsByServer: {
              ...s.soundsByServer,
              [p.server_id]: [p.sound, ...current]
            }
          }
        })
        return
      }

      if (event.type === 'soundboard:deleted') {
        const p = event.payload as SoundboardDeletedPayload
        if (!p?.server_id || !p?.sound_id) return
        set((s) => {
          const current = s.soundsByServer[p.server_id] ?? []
          return {
            soundsByServer: {
              ...s.soundsByServer,
              [p.server_id]: current.filter((x) => x.id !== p.sound_id)
            }
          }
        })
        return
      }

      if (event.type === 'call:soundboard') {
        const p = event.payload as CallSoundboardPayload
        const callState = useCallStore.getState()
        if (
          !p?.call_id ||
          callState.status !== 'active' ||
          callState.callId !== p.call_id ||
          !p.sound ||
          !p.user
        ) {
          return
        }

        const userId = p.user.id
        const playToken = nextPlayToken++
        const prevTimer = playTimers.get(userId)
        if (prevTimer) clearTimeout(prevTimer)

        const durationMs = Math.min(Math.max(p.sound.duration_ms || 3000, 500), 16_000)
        const timer = setTimeout(() => {
          clearUserPlay(userId, playToken)
        }, durationMs + 350)
        playTimers.set(userId, timer)

        set((s) => ({
          activePlays: {
            ...s.activePlays,
            [userId]: {
              soundId: p.sound.id,
              soundName: p.sound.name,
              emoji: p.sound.emoji ?? null,
              playToken
            }
          }
        }))

        const locallyMuted = useUserAudioStore.getState().get(userId).muted
        const volume = get().volume
        if (!callState.deafened && !locallyMuted && volume > 0) {
          void playSoundboardClip({
            soundId: p.sound.id,
            volume,
            onEnded: () => clearUserPlay(userId, playToken)
          })
        }
      }
    }
  }
})
