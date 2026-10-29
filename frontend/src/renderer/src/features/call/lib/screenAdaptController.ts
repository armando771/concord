import type { AdaptSample, Limitation } from './screenAdaptSample'

// Controlador de qualidade da live (estilo Discord/Twitch): o WebRTC mantém a
// resolução e nós trocamos de degrau (screenQualityLadder) quando o envio fica
// limitado, com histerese. Puro: uma leitura a cada ADAPT.tickMs.

export const ADAPT = {
  tickMs: 2000,
  /** Leituras ignoradas no começo: a estimativa de banda ainda está subindo. */
  startHold: 5,
  /** Leituras limitadas seguidas para descer um degrau (~6 s). */
  downAfter: 3,
  /** Leituras folgadas seguidas para tentar subir (~30 s). */
  upAfter: 15,
  /** Teto da espera para subir depois de tentativas que falharam (~5 min). */
  maxUpAfter: 150,
  /** Leituras ignoradas depois de cada troca (o encoder assenta). */
  hold: 4,
  /** Subiu e caiu em até tantas leituras: a subida falhou. */
  failWindow: 15
}

export interface AdaptState {
  /** Degrau atual (0 = o escolhido). */
  step: number
  bad: number
  good: number
  /** Leituras que ainda serão ignoradas. */
  hold: number
  upAfter: number
  /** Leituras desde a última subida (null = não está avaliando uma subida). */
  sinceUp: number | null
  /** Por que está abaixo do escolhido (ou limitado no piso). */
  reason: Limitation | null
}

export function initialAdapt(): AdaptState {
  return {
    step: 0,
    bad: 0,
    good: 0,
    hold: ADAPT.startHold,
    upAfter: ADAPT.upAfter,
    sinceUp: null,
    reason: null
  }
}

function stepDown(state: AdaptState, reason: Limitation, steps: number): AdaptState {
  if (state.step >= steps - 1) return { ...state, reason }
  const failedUp = state.sinceUp !== null && state.sinceUp <= ADAPT.failWindow
  return {
    ...state,
    step: state.step + 1,
    bad: 0,
    hold: ADAPT.hold,
    reason,
    sinceUp: null,
    upAfter: failedUp ? Math.min(ADAPT.maxUpAfter, state.upAfter * 2) : state.upAfter
  }
}

function stepUp(state: AdaptState): AdaptState {
  const step = state.step - 1
  return { ...state, step, good: 0, hold: ADAPT.hold, sinceUp: 0, reason: step ? state.reason : null }
}

/** Subida que durou: a espera para a próxima volta a encurtar. */
function settle(state: AdaptState): AdaptState {
  if (state.sinceUp === null) return state
  const sinceUp = state.sinceUp + 1
  if (sinceUp <= ADAPT.failWindow) return { ...state, sinceUp }
  return { ...state, sinceUp: null, upAfter: Math.max(ADAPT.upAfter, state.upAfter / 2) }
}

/** `steps`: quantos degraus a escada tem (o último é o piso). */
export function adaptTick(state: AdaptState, sample: AdaptSample | null, steps: number): AdaptState {
  if (!sample) return state
  if (state.hold > 0) return { ...state, hold: state.hold - 1 }
  const next = settle(state)
  if (sample.limited) {
    const bad = next.bad + 1
    return bad >= ADAPT.downAfter
      ? stepDown({ ...next, bad }, sample.limited, steps)
      : { ...next, bad, good: 0 }
  }
  const good = next.good + 1
  if (next.step > 0 && good >= next.upAfter) return stepUp(next)
  return { ...next, good, bad: 0, reason: next.step ? next.reason : null }
}
