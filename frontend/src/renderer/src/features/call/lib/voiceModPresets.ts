// Voice mod: presets e a tradução deles para parâmetros de áudio.
//
// Puro (sem DOM nem Web Audio): é usado pelo store, pelo grafo (voiceMod.ts) e
// nos testes.

export type VoiceModPreset =
  | 'normal'
  | 'grave'
  | 'esquilo'
  | 'robo'
  | 'eco'
  | 'radio'
  | 'monstro'
  | 'alien'
  | 'caverna'
  | 'fantasma'
  | 'telefone'
  | 'megafone'

/**
 * Efeito fixo de cada preset (os sliders ajustam por cima), composto por blocos
 * do grafo. Campo ausente = bloco neutro.
 */
export interface VoiceModEffect {
  /** Modulação de amplitude, em Hz (0 = desligada). */
  modHz?: number
  /** 1 = modulação em anel (multiplica por um seno: Robô); menos = tremolo. */
  modDepth?: number
  /** Vibrato: quantas vezes por segundo o tom oscila (0 = desligado). */
  vibratoHz?: number
  /** Quanto o tom oscila no vibrato, em semitons. */
  vibratoSemitones?: number
  /** Corte dos graves do passa-faixa, em Hz. */
  highpassHz?: number
  /** Corte dos agudos do passa-faixa, em Hz. */
  lowpassHz?: number
  /** Saturação (tanh); 0 = limpa. */
  drive?: number
  /** Nível do eco, 0…1. */
  echo?: number
  /** Nível do reverb, 0…1. */
  reverb?: number
}

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

export const PRESET_ORDER: VoiceModPreset[] = [
  'normal',
  'grave',
  'esquilo',
  'robo',
  'eco',
  'radio',
  'monstro',
  'alien',
  'caverna',
  'fantasma',
  'telefone',
  'megafone'
]

export const VOICE_MOD_PRESETS: Record<
  VoiceModPreset,
  { label: string; effect: VoiceModEffect; values: VoiceModValues }
> = {
  normal: { label: 'Normal', effect: {}, values: { pitch: 0, timbre: 0, intensity: 1 } },
  grave: { label: 'Grave', effect: {}, values: { pitch: -5, timbre: -0.5, intensity: 1 } },
  esquilo: { label: 'Esquilo', effect: {}, values: { pitch: 7, timbre: 0.5, intensity: 1 } },
  robo: {
    label: 'Robô',
    effect: { modHz: 50, modDepth: 1 },
    values: { pitch: 0, timbre: 0.2, intensity: 1 }
  },
  eco: { label: 'Eco', effect: { echo: 0.6 }, values: { pitch: 0, timbre: 0, intensity: 0.6 } },
  radio: {
    label: 'Rádio',
    effect: { highpassHz: 300, lowpassHz: 3400, drive: 3 },
    values: { pitch: 0, timbre: 0.3, intensity: 1 }
  },
  // Bem grave e grosso, com um ronco de saturação leve.
  monstro: {
    label: 'Monstro',
    effect: { drive: 2 },
    values: { pitch: -9, timbre: -0.6, intensity: 1 }
  },
  // Agudo, com o tom ondulando e um zumbido metálico por cima.
  alien: {
    label: 'Alien',
    effect: { vibratoHz: 6, vibratoSemitones: 0.8, modHz: 90, modDepth: 0.3 },
    values: { pitch: 5, timbre: 0.4, intensity: 1 }
  },
  // Voz original numa caverna: reverb longo e escuro.
  caverna: {
    label: 'Caverna',
    effect: { reverb: 0.7 },
    values: { pitch: 0, timbre: -0.2, intensity: 1 }
  },
  // Um pouco mais grave, tremendo devagar e ecoando ao longe.
  fantasma: {
    label: 'Fantasma',
    effect: { reverb: 0.8, modHz: 5, modDepth: 0.4 },
    values: { pitch: -2, timbre: 0.4, intensity: 1 }
  },
  // Linha fixa antiga: banda estreita e fina, quase sem sujeira.
  telefone: {
    label: 'Telefone',
    effect: { highpassHz: 500, lowpassHz: 2600, drive: 1.5 },
    values: { pitch: 0, timbre: 0.3, intensity: 1 }
  },
  // Corneta: só os médios, saturada e alta.
  megafone: {
    label: 'Megafone',
    effect: { highpassHz: 700, lowpassHz: 4500, drive: 5 },
    values: { pitch: 0, timbre: 0.5, intensity: 1 }
  }
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

/** Quanto o timbre empurra os shelves de graves e agudos, em dB. */
export const TIMBRE_SHELF_DB = 8
/** Valores "abertos" do passa-faixa: passam o sinal sem mexer. */
export const OPEN_HIGHPASS_HZ = 10
export const OPEN_LOWPASS_HZ = 20_000

/** Todos os blocos neutros: o que vale para o campo que o preset não define. */
const NEUTRAL_EFFECT: Required<VoiceModEffect> = {
  modHz: 0,
  modDepth: 0,
  vibratoHz: 0,
  vibratoSemitones: 0,
  highpassHz: OPEN_HIGHPASS_HZ,
  lowpassHz: OPEN_LOWPASS_HZ,
  drive: 0,
  echo: 0,
  reverb: 0
}

function isNeutral(effect: Required<VoiceModEffect>): boolean {
  return (Object.keys(NEUTRAL_EFFECT) as (keyof VoiceModEffect)[]).every(
    (key) => effect[key] === NEUTRAL_EFFECT[key]
  )
}

/** Valores finais de cada bloco do grafo (voiceMod.ts só os copia nos nós). */
export interface VoiceModParams extends Required<VoiceModEffect> {
  /** Sem tom, timbre nem efeito: o sinal passa direto, sem latência extra. */
  bypass: boolean
  pitchRatio: number
  lowShelfDb: number
  highShelfDb: number
  /** Ganho do caminho seco (0 no bypass). */
  dry: number
  /** Ganho do caminho processado (0 no bypass). */
  wet: number
}

export function voiceModParams(settings: VoiceModSettings): VoiceModParams {
  const effect = { ...NEUTRAL_EFFECT, ...VOICE_MOD_PRESETS[settings.preset].effect }
  const bypass = isNeutral(effect) && settings.pitch === 0 && settings.timbre === 0
  const live = bypass ? 0 : 1
  return {
    ...effect,
    bypass,
    pitchRatio: 2 ** (settings.pitch / 12),
    lowShelfDb: -settings.timbre * TIMBRE_SHELF_DB,
    highShelfDb: settings.timbre * TIMBRE_SHELF_DB,
    dry: live * (1 - settings.intensity),
    wet: live * settings.intensity
  }
}

export function isVoiceModActive(settings: VoiceModSettings): boolean {
  return !voiceModParams(settings).bypass
}
