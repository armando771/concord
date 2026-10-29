// Grafo Web Audio do voice mod. Vive dentro do AudioContext do microfone
// (noiseSuppression.ts), depois do ganho de entrada.
//
//   in ─ bypass ──────────────────────────────────────────────────────────┐
//   in ─ dryDelay ─ dry ──────────────────────────────────────────────────┤
//   in ─ shifter ─ passa-altas ─ passa-baixas ─ saturação ─ timbre ─┬─ wet ─ limitador ─┴─ out
//                                                  ├─ eco ──────┤
//                                                  └─ envio ─ reverb ┘
//
// O grafo inteiro só existe com uma voz ativa: no Normal ele sai do caminho do
// microfone e é destruído (audioStageSwitch.ts), e volta novo ao escolher uma
// voz. Enquanto existe, todo bloco fica no grafo e é neutralizado pelos
// parâmetros (filtros abertos, curva nula, envios em 0): trocar entre vozes só
// mexe em valores, nunca reconecta nós, então vale ao vivo sem estalo. Os
// envios ficam antes do eco e do reverb: com ganho 0 o navegador vê silêncio e
// para de processar o convolver depois da cauda (o reverb não pesa na CPU fora
// dos presets dele).
// O caminho seco tem o mesmo atraso do pitch shifter para não haver filtro
// pente ao misturar os dois; por isso o limitador é um WaveShaper (sem atraso)
// e não um DynamicsCompressor (que tem look-ahead).
import { switchStage } from './audioStageSwitch'
import { dspProcessorOptions } from './dspModule'
import voiceModWorkletUrl from './voiceModWorklet.ts?worker&url'
import { driveCurve, reverbImpulse, softLimitCurve } from './voiceModCurves'
import {
  VOICE_MOD_LATENCY_MS,
  VOICE_MOD_PROCESSOR,
  VOICE_MOD_STOP,
  type VoiceModWorkletMessage
} from './voiceModDsp'
import { isVoiceModActive, voiceModParams, type VoiceModSettings } from './voiceModPresets'

/** Constante de tempo do crossfade ao trocar de preset ou mexer num slider. */
const FADE_SECONDS = 0.015
const ECHO_DELAY_SECONDS = 0.28
const ECHO_FEEDBACK = 0.35
const REVERB = { seconds: 2.2, preDelaySeconds: 0.03 }
/** O processado entra no limitador dividido por isto (picos de até 2× ainda cabem). */
const LIMITER_HEADROOM = 2
const LIMITER_CURVE = softLimitCurve(0.8, LIMITER_HEADROOM)
/**
 * Espera do grafo recém-montado antes do crossfade: o processador sobe na
 * thread de áudio e o pitch shifter enche meia janela (25 ms) antes de ter som.
 */
const VOICE_MOD_WARMUP_SECONDS = 0.06

export interface VoiceModNode {
  input: AudioNode
  output: AudioNode
  /** `instant`: sem rampa (primeira aplicação, antes de o áudio rodar). */
  apply: (settings: VoiceModSettings, instant: boolean) => void
  /** Desliga os nós e para o worklet de vez (o process() devolve false). */
  destroy: () => void
}

/**
 * Registra o worklet no contexto (uma vez) e devolve quem monta o grafo, na
 * hora e sem esperar nada. Rejeita se o worklet não carregar; quem chama segue
 * sem voice mod.
 */
export async function loadVoiceMod(ctx: AudioContext): Promise<() => VoiceModNode> {
  const [, processorOptions] = await Promise.all([
    ctx.audioWorklet.addModule(voiceModWorkletUrl),
    dspProcessorOptions()
  ])
  return () => buildVoiceMod(ctx, processorOptions)
}

function buildVoiceMod(
  ctx: AudioContext,
  processorOptions: Awaited<ReturnType<typeof dspProcessorOptions>>
): VoiceModNode {
  const input = ctx.createGain()
  input.channelCount = 1
  input.channelCountMode = 'explicit'
  const output = ctx.createGain()
  const bypass = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const dryDelay = ctx.createDelay(0.1)
  dryDelay.delayTime.value = VOICE_MOD_LATENCY_MS / 1000
  const shifter = new AudioWorkletNode(ctx, VOICE_MOD_PROCESSOR, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions
  })
  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  const shaper = ctx.createWaveShaper()
  const low = ctx.createBiquadFilter()
  low.type = 'lowshelf'
  low.frequency.value = 250
  const high = ctx.createBiquadFilter()
  high.type = 'highshelf'
  high.frequency.value = 3000
  const echoDelay = ctx.createDelay(1)
  echoDelay.delayTime.value = ECHO_DELAY_SECONDS
  const echoFeedback = ctx.createGain()
  echoFeedback.gain.value = ECHO_FEEDBACK
  const echoLevel = ctx.createGain()
  const reverbSend = ctx.createGain()
  const reverb = ctx.createConvolver()
  reverb.normalize = false
  const impulse = reverbImpulse(ctx.sampleRate, REVERB)
  const impulseBuffer = ctx.createBuffer(1, impulse.length, ctx.sampleRate)
  impulseBuffer.getChannelData(0).set(impulse)
  reverb.buffer = impulseBuffer
  const limiter = ctx.createWaveShaper()
  limiter.curve = LIMITER_CURVE

  input.connect(bypass).connect(output)
  input.connect(dryDelay).connect(dry).connect(output)
  input
    .connect(shifter)
    .connect(highpass)
    .connect(lowpass)
    .connect(shaper)
    .connect(low)
    .connect(high)
    .connect(wet)
    .connect(limiter)
    .connect(output)
  high.connect(echoLevel).connect(echoDelay).connect(echoFeedback).connect(echoDelay)
  echoDelay.connect(wet)
  high.connect(reverbSend).connect(reverb).connect(wet)

  const nodes: AudioNode[] = [
    input,
    output,
    bypass,
    dry,
    wet,
    dryDelay,
    shifter,
    highpass,
    lowpass,
    shaper,
    low,
    high,
    echoDelay,
    echoFeedback,
    echoLevel,
    reverbSend,
    reverb,
    limiter
  ]

  const set = (param: AudioParam, value: number, instant: boolean): void => {
    const t = ctx.currentTime
    param.cancelScheduledValues(t)
    if (instant) param.setValueAtTime(value, t)
    else param.setTargetAtTime(value, t, FADE_SECONDS)
  }

  return {
    input,
    output,
    apply: (settings, instant) => {
      const p = voiceModParams(settings)
      const targets: [AudioParam, number][] = [
        [bypass.gain, Number(p.bypass)],
        [dry.gain, p.dry],
        [wet.gain, p.wet / LIMITER_HEADROOM],
        [low.gain, p.lowShelfDb],
        [high.gain, p.highShelfDb],
        [highpass.frequency, p.highpassHz],
        [lowpass.frequency, p.lowpassHz],
        [echoLevel.gain, p.echo],
        [reverbSend.gain, p.reverb]
      ]
      targets.forEach(([param, value]) => set(param, value, instant))
      shaper.curve = driveCurve(p.drive)
      const message: VoiceModWorkletMessage = {
        ratio: p.pitchRatio,
        modHz: p.modHz,
        modDepth: p.modDepth,
        vibratoHz: p.vibratoHz,
        vibratoSemitones: p.vibratoSemitones
      }
      shifter.port.postMessage(message)
    },
    destroy: () => {
      nodes.forEach((node) => node.disconnect())
      shifter.port.postMessage(VOICE_MOD_STOP)
    }
  }
}

/** O voice mod no caminho do microfone: entra só com uma voz ativa. */
export interface VoiceModPath {
  output: AudioNode
  apply: (settings: VoiceModSettings) => void
  destroy: () => void
}

/**
 * `input` ─┬─ direto ─────────────┬─ output
 *          └─ voice mod ─ ganho ──┘
 * No Normal sem ajuste o voice mod não existe; ao escolher uma voz ele é
 * montado já com ela e entra por crossfade (audioStageSwitch.ts).
 */
export function voiceModPath(
  ctx: AudioContext,
  input: AudioNode,
  create: () => VoiceModNode,
  initial: VoiceModSettings
): VoiceModPath {
  const direct = ctx.createGain()
  const through = ctx.createGain()
  through.gain.value = 0
  const output = ctx.createGain()
  input.connect(direct).connect(output)
  through.connect(output)
  let latest = initial
  const mount = (): VoiceModNode | null => {
    try {
      const mod = create()
      mod.apply(latest, true)
      return mod
    } catch (err) {
      console.error('[voz] voice mod não montou:', err)
      return null
    }
  }
  const stage = switchStage({
    ctx,
    source: input,
    direct,
    through,
    create: mount,
    warmupSeconds: VOICE_MOD_WARMUP_SECONDS
  })
  const apply = (settings: VoiceModSettings): void => {
    latest = settings
    const live = stage.current()
    const active = isVoiceModActive(settings)
    stage.set(active)
    // Já montado (trocando de voz, ou voltando antes de desmontar): só os valores.
    if (live && active) live.apply(settings, false)
  }
  apply(initial)
  return { output, apply, destroy: stage.destroy }
}
