import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  clampIntensity,
  clampPitch,
  clampTimbre,
  VOICE_MOD_PRESETS,
  type VoiceModPreset,
  type VoiceModSettings
} from '../lib/voiceModPresets'

// Voice mod (Mesa de Áudio → Voz), guardado neste PC. O efeito é aplicado no
// microfone de quem fala, então todos na chamada ouvem a voz alterada.

interface VoiceModState extends VoiceModSettings {
  /** O worklet carregou no último microfone aberto (falso = voice mod indisponível). */
  available: boolean
  /** Ouvindo a própria voz alterada (não persiste). */
  monitoring: boolean
  selectPreset: (preset: VoiceModPreset) => void
  setPitch: (pitch: number) => void
  setTimbre: (timbre: number) => void
  setIntensity: (intensity: number) => void
  setAvailable: (available: boolean) => void
  setMonitoring: (monitoring: boolean) => void
}

export const useVoiceModStore = create<VoiceModState>()(
  persist(
    (set) => ({
      preset: 'normal',
      customized: false,
      ...VOICE_MOD_PRESETS.normal.values,
      available: true,
      monitoring: false,
      selectPreset: (preset) =>
        set({ preset, customized: false, ...VOICE_MOD_PRESETS[preset].values }),
      setPitch: (pitch) => set({ pitch: clampPitch(pitch), customized: true }),
      setTimbre: (timbre) => set({ timbre: clampTimbre(timbre), customized: true }),
      setIntensity: (intensity) => set({ intensity: clampIntensity(intensity), customized: true }),
      setAvailable: (available) => set({ available }),
      setMonitoring: (monitoring) => set({ monitoring })
    }),
    {
      name: 'concord-voice-mod',
      partialize: ({ preset, customized, pitch, timbre, intensity }) => ({
        preset,
        customized,
        pitch,
        timbre,
        intensity
      })
    }
  )
)
