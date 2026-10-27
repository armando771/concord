// Etapa do microfone que sai do grafo quando não faz nada (RNNoise com a
// supressão desligada, voice mod no Normal). Ligada no meio da chamada, entra
// com um crossfade curto entre o caminho direto e ela:
//
//   source ─ direct ─────────────┬─ (saída, de quem chama)
//   source ─ etapa ─ through ────┘
//
// Os dois ganhos ficam sempre ligados à saída; só a etapa entra e sai. A track
// enviada ao LiveKit é a mesma o tempo todo (nada é republicado).
//
// Por que desmontar em vez de só desligar: no Chromium (152 / Electron 44,
// medido) um AudioWorkletNode cujo process() devolve true roda ~375 vezes por
// segundo mesmo sem nada ligado na entrada nem na saída; e depois que o
// process() devolve false ele nunca mais é chamado, nem se religar. Então a
// etapa inativa é destruída (o worklet devolve false) e recriada ao voltar —
// com estado limpo, sem resto de áudio antigo nos buffers. Os nós nativos
// (filtros, delays, convolver) sem caminho até o destino não são processados.

/** Rampa linear do crossfade (10–20 ms: sem estalo e sem demora perceptível). */
export const STAGE_FADE_SECONDS = 0.015
/** Desmonta a etapa depois de a rampa de saída terminar (com folga). */
export const STAGE_TEARDOWN_MS = 60

export interface AudioStage {
  input: AudioNode
  output: AudioNode
  /** Libera de vez (o worklet para de rodar). */
  destroy: () => void
}

/** Quais etapas entram no grafo do microfone. */
export function micStages(settings: { voiceModActive: boolean; noiseSuppression: boolean }): {
  rnnoise: boolean
  voiceMod: boolean
} {
  return { rnnoise: settings.noiseSuppression, voiceMod: settings.voiceModActive }
}

export interface StageSwitchOptions<T extends AudioStage> {
  ctx: { currentTime: number }
  source: AudioNode
  /** Caminho sem a etapa (1 com ela fora). Já ligado à saída. */
  direct: GainNode
  /** Saída da etapa (0 com ela fora). Já ligado à saída. */
  through: GainNode
  /** Cria a etapa; `null` se não der (fica fora do grafo). */
  create: () => T | null
  /** Quanto a etapa nova leva para ter áudio (worklet subindo, buffers enchendo). */
  warmupSeconds: number
}

export interface StageSwitch<T extends AudioStage> {
  set: (on: boolean) => void
  /** A etapa no grafo (inclusive saindo), ou null. */
  current: () => T | null
  destroy: () => void
}

/** Segura o valor de agora e descarta o que estava agendado depois. */
function holdAt(param: AudioParam, t: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(t)
    return
  }
  // Firefox não tem cancelAndHoldAtTime.
  const value = param.value
  param.cancelScheduledValues(t)
  param.setValueAtTime(value, t)
}

/**
 * Crossfade para `on`. Com `start` depois de agora (etapa recém-criada), os
 * ganhos ficam parados até lá: o direto em 1 e a etapa em 0.
 */
function crossfade(direct: GainNode, through: GainNode, now: number, start: number, on: boolean): void {
  const targets: [AudioParam, number][] = [
    [through.gain, on ? 1 : 0],
    [direct.gain, on ? 0 : 1]
  ]
  for (const [param, to] of targets) {
    holdAt(param, now)
    if (start > now) param.setValueAtTime(1 - to, start)
    param.linearRampToValueAtTime(to, start + STAGE_FADE_SECONDS)
  }
}

export function switchStage<T extends AudioStage>(options: StageSwitchOptions<T>): StageSwitch<T> {
  const { ctx, source, direct, through, create, warmupSeconds } = options
  let stage: T | null = null
  let wanted = false
  let teardown: ReturnType<typeof setTimeout> | null = null

  const cancelTeardown = (): void => {
    if (teardown !== null) clearTimeout(teardown)
    teardown = null
  }
  const unmount = (): void => {
    cancelTeardown()
    if (!stage) return
    source.disconnect(stage.input)
    stage.output.disconnect(through)
    stage.destroy()
    stage = null
  }
  const mount = (): boolean => {
    stage = create()
    if (!stage) return false
    source.connect(stage.input)
    stage.output.connect(through)
    return true
  }
  const enter = (): void => {
    const now = ctx.currentTime
    if (stage) {
      cancelTeardown()
      crossfade(direct, through, now, now, true)
    } else if (mount()) {
      crossfade(direct, through, now, now + warmupSeconds, true)
    } else {
      wanted = false
    }
  }
  const leave = (): void => {
    if (!stage) return
    crossfade(direct, through, ctx.currentTime, ctx.currentTime, false)
    teardown = setTimeout(unmount, STAGE_TEARDOWN_MS)
  }

  return {
    set: (on) => {
      if (on === wanted) return
      wanted = on
      if (on) enter()
      else leave()
    },
    current: () => stage,
    destroy: () => {
      wanted = false
      unmount()
    }
  }
}
