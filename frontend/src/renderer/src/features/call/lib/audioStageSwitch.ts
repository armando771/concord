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
//
// Rampas sem estalo (medido no Electron 44, trocando uma senoide pelo inverso):
// - começam um pouco no futuro: o `currentTime` que a página lê fica atrás do
//   que a thread de áudio já renderizou (até um buffer, `baseLatency`); uma
//   rampa marcada "agora" já começa no passado e o ganho salta;
// - nunca cancelam nada: cada rampa entra depois do fim da anterior. O
//   `cancelAndHoldAtTime` seguido de rampa saltava de 1 para 0,13 na hora no
//   Chromium, e o `cancelScheduledValues` no meio de uma rampa volta o ganho
//   ao valor de antes dela. Inverter no meio custa no máximo os 15 ms da rampa.

/** Rampa linear do crossfade (10–20 ms: sem estalo e sem demora perceptível). */
export const STAGE_FADE_SECONDS = 0.015
/** Antecedência mínima das rampas, além da `baseLatency` do contexto. */
export const STAGE_LEAD_SECONDS = 0.02
/** Folga entre o fim da rampa de saída e a desmontagem. */
export const STAGE_TEARDOWN_MARGIN_MS = 50

type StageContext = Pick<BaseAudioContext, 'currentTime'> & { baseLatency?: number }

/** Quando a rampa pode começar sem cair no passado da thread de áudio. */
export function stageLead(ctx: StageContext): number {
  return STAGE_LEAD_SECONDS + (ctx.baseLatency ?? 0)
}

/**
 * Início da próxima rampa: com a antecedência e nunca antes do fim da
 * anterior (`lastEnd`), mais a espera da etapa recém-criada (`delay`).
 */
export function fadeStart(ctx: StageContext, lastEnd: number, delay: number): number {
  return Math.max(ctx.currentTime + stageLead(ctx), lastEnd) + delay
}

export interface AudioStage {
  input: AudioNode
  output: AudioNode
  /** Libera de vez (o worklet para de rodar). */
  destroy: () => void
}

export interface StageSwitchOptions<T extends AudioStage> {
  ctx: StageContext
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

export function switchStage<T extends AudioStage>(options: StageSwitchOptions<T>): StageSwitch<T> {
  const { ctx, source, direct, through, create, warmupSeconds } = options
  let stage: T | null = null
  let wanted = false
  let lastEnd = 0
  let teardown: ReturnType<typeof setTimeout> | null = null

  /** Crossfade para `on`; devolve quando termina (tempo do áudio). */
  const crossfade = (on: boolean, delay: number): number => {
    const start = fadeStart(ctx, lastEnd, delay)
    lastEnd = start + STAGE_FADE_SECONDS
    const targets: [AudioParam, number][] = [
      [through.gain, on ? 1 : 0],
      [direct.gain, on ? 0 : 1]
    ]
    for (const [param, to] of targets) {
      // Até o início vale o alvo da rampa anterior (o oposto deste).
      param.setValueAtTime(1 - to, start)
      param.linearRampToValueAtTime(to, lastEnd)
    }
    return lastEnd
  }
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
    if (stage) {
      cancelTeardown()
      crossfade(true, 0)
    } else if (mount()) {
      crossfade(true, warmupSeconds)
    } else {
      wanted = false
    }
  }
  const leave = (): void => {
    if (!stage) return
    const end = crossfade(false, 0)
    const ms = Math.ceil((end - ctx.currentTime) * 1000) + STAGE_TEARDOWN_MARGIN_MS
    teardown = setTimeout(unmount, ms)
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
