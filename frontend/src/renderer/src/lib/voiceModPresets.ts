// Voice mod: presets e a tradução deles para parâmetros de áudio.
//
// Puro (sem DOM nem Web Audio): é usado pelo store, pelo grafo (voiceMod.ts) e
// nos testes.

export type VoiceModPreset = 'normal' | 'grave' | 'esquilo' | 'robo' | 'eco' | 'radio'
/** Efeito fixo de cada preset (os sliders ajustam por cima). */
export type VoiceModEffect = 'none' | 'ring' | 'echo' | 'radio'

export interface VoiceModValues {
  /** Semitons, −12…+12. */
  pitch: number
  /** −1 (voz mais grossa) … +1 (mais fina). */
  timbre: number
  /** 0 = voz original … 1 = só a voz processada. */
  intensity: number
}

export interface VoiceModSettings extends VoiceModValues {
  /** Preset de base: define o efeito e os valores iniciais dos sliders. */
  preset: VoiceModPreset
  /** Algum slider foi mexido depois de escolher o preset. */
  customized: boolean
}

export const PITCH_MIN = -12
export const PITCH_MAX = 12

export const PRESET_ORDER: VoiceModPreset[] = ['normal', 'grave', 'esquilo', 'robo', 'eco', 'radio']

export const VOICE_MOD_PRESETS: Record<
  VoiceModPreset,
  { label: string; effect: VoiceModEffect; values: VoiceModValues }
> = {
  normal: { label: 'Normal', effect: 'none', values: { pitch: 0, timbre: 0, intensity: 1 } },
  grave: { label: 'Grave', effect: 'none', values: { pitch: -5, timbre: -0.5, intensity: 1 } },
  esquilo: { label: 'Esquilo', effect: 'none', values: { pitch: 7, timbre: 0.5, intensity: 1 } },
  robo: { label: 'Robô', effect: 'ring', values: { pitch: 0, timbre: 0.2, intensity: 1 } },
  eco: { label: 'Eco', effect: 'echo', values: { pitch: 0, timbre: 0, intensity: 0.6 } },
  radio: { label: 'Rádio', effect: 'radio', values: { pitch: 0, timbre: 0.3, intensity: 1 } }
}

export function clampPitch(pitch: number): number {
  return Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch))
}

export function clampTimbre(timbre: number): number {
  return Math.min(1, Math.max(-1, timbre))
}

export function clampIntensity(intensity: number): number {
  return Math.min(1, Math.max(0, intensity))
}

/** Frequência do oscilador do "Robô" (modulação em anel). */
export const RING_HZ = 50
/** Quanto o timbre empurra os shelves de graves e agudos, em dB. */
export const TIMBRE_SHELF_DB = 8

export interface VoiceModParams {
  /** Sem tom, timbre nem efeito: o sinal passa direto, sem latência extra. */
  bypass: boolean
  pitchRatio: number
  /** 0 = sem modulação em anel. */
  ringHz: number
  echo: boolean
  radio: boolean
  lowShelfDb: number
  highShelfDb: number
  dry: number
  wet: number
}

export function voiceModParams(settings: VoiceModSettings): VoiceModParams {
  const { effect } = VOICE_MOD_PRESETS[settings.preset]
  return {
    bypass: effect === 'none' && settings.pitch === 0 && settings.timbre === 0,
    pitchRatio: 2 ** (settings.pitch / 12),
    ringHz: effect === 'ring' ? RING_HZ : 0,
    echo: effect === 'echo',
    radio: effect === 'radio',
    lowShelfDb: -settings.timbre * TIMBRE_SHELF_DB,
    highShelfDb: settings.timbre * TIMBRE_SHELF_DB,
    dry: 1 - settings.intensity,
    wet: settings.intensity
  }
}

export function isVoiceModActive(settings: VoiceModSettings): boolean {
  return !voiceModParams(settings).bypass
}
