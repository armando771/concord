import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Volumes e sensibilidade da voz (Configurações → Voz), guardados neste PC.
// Volume de 0 a 150%: passar de 100% é um boost.

/** Teto do volume de entrada e de saída: 150%. */
export const VOLUME_MAX = 1.5

export interface VoiceAudioSettings {
  /** 0–1,5 (1 = 100%). */
  inputVolume: number
  /** 0–1,5 (1 = 100%). */
  outputVolume: number
  /** Portão ligado: só envia a voz quando passa da sensibilidade. */
  detectionEnabled: boolean
  /** 0–100 (mais à direita = capta vozes mais baixas). */
  sensitivity: number
}

interface VoiceAudioState extends VoiceAudioSettings {
  setInputVolume: (volume: number) => void
  setOutputVolume: (volume: number) => void
  setDetectionEnabled: (enabled: boolean) => void
  setSensitivity: (sensitivity: number) => void
}

export function clampVolume(volume: number): number {
  return Math.min(VOLUME_MAX, Math.max(0, volume))
}

export function clampSensitivity(sensitivity: number): number {
  return Math.min(100, Math.max(0, sensitivity))
}

export const useVoiceAudioStore = create<VoiceAudioState>()(
  persist(
    (set) => ({
      inputVolume: 1,
      outputVolume: 1,
      detectionEnabled: true,
      sensitivity: 60,
      setInputVolume: (volume) => set({ inputVolume: clampVolume(volume) }),
      setOutputVolume: (volume) => set({ outputVolume: clampVolume(volume) }),
      setDetectionEnabled: (detectionEnabled) => set({ detectionEnabled }),
      setSensitivity: (sensitivity) => set({ sensitivity: clampSensitivity(sensitivity) })
    }),
    {
      name: 'concord-voice-audio',
      partialize: ({ inputVolume, outputVolume, detectionEnabled, sensitivity }) => ({
        inputVolume,
        outputVolume,
        detectionEnabled,
        sensitivity
      })
    }
  )
)
