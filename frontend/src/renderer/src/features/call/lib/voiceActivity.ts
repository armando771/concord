// Detecção de fala do próprio usuário, feita aqui no cliente. A do LiveKit
// (ActiveSpeakersChanged) vem do servidor: mic → SFU → detecção com
// suavização → sinal de volta, então o próprio anel verde acendia atrasado.
// Os outros continuam vindo do servidor (já chegam junto com a voz deles).
//
// Auto-contido (sem DOM): roda dentro do AudioWorklet (voiceActivityWorklet.ts)
// e nos testes.

export interface VoiceActivityConfig {
  /** Sem estar falando, acende com o nível (RMS, dBFS) a partir disto. */
  onDb: number
  /** Já falando, só conta como silêncio abaixo disto (histerese: não pisca no limiar). */
  offDb: number
  /** Tempo contínuo acima de onDb para acender (a própria janela já integra ~32 ms). */
  attackMs: number
  /** Silêncio contínuo para apagar — segura o anel entre as palavras. */
  hangoverMs: number
}

export const VOICE_ACTIVITY_DEFAULTS: VoiceActivityConfig = {
  onDb: -40,
  offDb: -46,
  attackMs: 0,
  hangoverMs: 300
}

/** Nome do processador registrado pelo voiceActivityWorklet. */
export const VOICE_ACTIVITY_PROCESSOR = 'concord-voice-activity'

/** Janela de análise: ~31 avaliações por segundo. */
export const VOICE_ACTIVITY_WINDOW_MS = 32

/** Histerese da sensibilidade: sai da fala 6 dB abaixo de onde entrou. */
const HYSTERESIS_DB = 6
/** Limiar da sensibilidade: 0 = só voz alta, 100 = qualquer som. */
const THRESHOLD_LOUDEST_DB = -10
const THRESHOLD_QUIETEST_DB = -60

/** Portão de ruído: o áudio sai com este atraso, para o portão já estar aberto. */
export const GATE_LOOKAHEAD_MS = 40
export const GATE_ATTACK_MS = 2
export const GATE_RELEASE_MS = 30

/** Piso do nível (silêncio absoluto vira um número finito). */
const FLOOR_DB = -120

export interface VoiceActivityState {
  speaking: boolean
  /** Desde quando o nível está acima do limiar (-1 = não está). */
  loudSince: number
  /** Última janela acima do limiar. */
  lastLoudAt: number
}

export function createVoiceActivityState(): VoiceActivityState {
  return { speaking: false, loudSince: -1, lastLoudAt: -Infinity }
}

/**
 * Avança a máquina de estados com o nível de uma janela e diz se está
 * falando. Atualiza `state` no lugar (roda ~31×/s na thread de áudio, sem
 * alocar nada); fora isso não tem efeito colateral — o relógio vem de fora.
 */
export function stepVoiceActivity(
  state: VoiceActivityState,
  levelDb: number,
  nowMs: number,
  config: VoiceActivityConfig = VOICE_ACTIVITY_DEFAULTS
): boolean {
  const loud = levelDb >= (state.speaking ? config.offDb : config.onDb)
  if (loud) {
    if (state.loudSince < 0) state.loudSince = nowMs
    state.lastLoudAt = nowMs
    if (!state.speaking && nowMs - state.loudSince >= config.attackMs) state.speaking = true
  } else {
    state.loudSince = -1
    if (state.speaking && nowMs - state.lastLoudAt >= config.hangoverMs) state.speaking = false
  }
  return state.speaking
}

/** Nível RMS em dBFS a partir da soma dos quadrados de `count` amostras. */
export function rmsDb(sumOfSquares: number, count: number): number {
  if (count <= 0 || sumOfSquares <= 0) return FLOOR_DB
  return Math.max(FLOOR_DB, 10 * Math.log10(sumOfSquares / count))
}

/**
 * Quem está falando: os outros como o servidor diz; o próprio usuário pela
 * detecção local (`null` = indisponível, aí vale o servidor também para ele).
 */
export function mergeLocalSpeaking(
  serverIds: string[],
  meId: string | null,
  localSpeaking: boolean | null
): string[] {
  if (meId === null || localSpeaking === null) return serverIds
  const others = serverIds.filter((id) => id !== meId)
  return localSpeaking ? [...others, meId] : others
}

/** Mesma lista (na mesma ordem) — evita re-render quando nada mudou. */
export function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

/** Limiar em dBFS para uma sensibilidade de 0 a 100 (mais à direita = mais sensível). */
export function thresholdDb(sensitivity: number): number {
  const s = Math.min(100, Math.max(0, sensitivity))
  return THRESHOLD_LOUDEST_DB - (s / 100) * (THRESHOLD_LOUDEST_DB - THRESHOLD_QUIETEST_DB)
}

/** Detector para uma sensibilidade de 0 a 100. */
export function voiceActivityFor(sensitivity: number): VoiceActivityConfig {
  const onDb = thresholdDb(sensitivity)
  return { ...VOICE_ACTIVITY_DEFAULTS, onDb, offDb: onDb - HYSTERESIS_DB }
}

/** Mensagem da thread principal para o worklet: o detector e se o portão está ligado. */
export interface VoiceActivitySettings {
  config: VoiceActivityConfig
  gate: boolean
}

/** Coeficiente de suavização por amostra para uma constante de tempo em ms. */
export function smoothingCoefficient(ms: number, sampleRate: number): number {
  return 1 - Math.exp(-1000 / (ms * sampleRate))
}
