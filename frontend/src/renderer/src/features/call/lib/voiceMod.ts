// Grafo Web Audio do voice mod. Vive dentro do AudioContext do microfone
// (noiseSuppression.ts), depois do ganho de entrada.
//
//   in ─ bypass ───────────────────────────────────────────────┐
//   in ─ dryDelay ─ dry ───────────────────────────────────────┤
//   in ─ shifter ─ rádio ─ timbre ─ wet ─┬─────────────────────┴─ out
//                              └─ eco ───┘
//
// Rádio e eco ficam sempre no grafo e são neutralizados pelos parâmetros
// (passa-faixa aberto, curva nula, ganho do eco em 0): trocar de preset só
// mexe em valores, nunca reconecta nós, então vale ao vivo sem estalo.
// O caminho seco tem o mesmo atraso do pitch shifter para não haver filtro
// pente ao misturar os dois.
import voiceModWorkletUrl from './voiceModWorklet.ts?worker&url'
import {
  VOICE_MOD_LATENCY_MS,
  VOICE_MOD_PROCESSOR,
  type VoiceModWorkletMessage
} from './voiceModDsp'
import { voiceModParams, type VoiceModSettings } from './voiceModPresets'

/** Constante de tempo do crossfade ao trocar de preset ou mexer num slider. */
const FADE_SECONDS = 0.015
const ECHO_DELAY_SECONDS = 0.28
const ECHO_FEEDBACK = 0.35
const ECHO_LEVEL = 0.6
const RADIO_HIGHPASS_HZ = 300
const RADIO_LOWPASS_HZ = 3400
/** Valores "abertos" dos filtros do rádio: passam o sinal sem mexer. */
const OPEN_HIGHPASS_HZ = 10
const OPEN_LOWPASS_HZ = 20_000

/** Saturação suave do rádio. */
const RADIO_CURVE = (() => {
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(3 * x) / Math.tanh(3)
  }
  return curve
})()

export interface VoiceModNode {
  input: AudioNode
  output: AudioNode
  /** `instant`: sem rampa (primeira aplicação, antes de o áudio rodar). */
  apply: (settings: VoiceModSettings, instant: boolean) => void
  destroy: () => void
}

/** Rejeita se o worklet não carregar; quem chama segue sem voice mod. */
export async function createVoiceMod(ctx: AudioContext): Promise<VoiceModNode> {
  await ctx.audioWorklet.addModule(voiceModWorkletUrl)

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
    outputChannelCount: [1]
  })
  const radioHigh = ctx.createBiquadFilter()
  radioHigh.type = 'highpass'
  const radioLow = ctx.createBiquadFilter()
  radioLow.type = 'lowpass'
  const radioClip = ctx.createWaveShaper()
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

  input.connect(bypass).connect(output)
  input.connect(dryDelay).connect(dry).connect(output)
  input
    .connect(shifter)
    .connect(radioHigh)
    .connect(radioLow)
    .connect(radioClip)
    .connect(low)
    .connect(high)
    .connect(wet)
    .connect(output)
  high.connect(echoDelay).connect(echoFeedback).connect(echoDelay)
  echoDelay.connect(echoLevel).connect(wet)

  const nodes: AudioNode[] = [
    input,
    output,
    bypass,
    dry,
    wet,
    dryDelay,
    shifter,
    radioHigh,
    radioLow,
    radioClip,
    low,
    high,
    echoDelay,
    echoFeedback,
    echoLevel
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
      set(bypass.gain, p.bypass ? 1 : 0, instant)
      set(dry.gain, p.bypass ? 0 : p.dry, instant)
      set(wet.gain, p.bypass ? 0 : p.wet, instant)
      set(low.gain, p.lowShelfDb, instant)
      set(high.gain, p.highShelfDb, instant)
      set(radioHigh.frequency, p.radio ? RADIO_HIGHPASS_HZ : OPEN_HIGHPASS_HZ, instant)
      set(radioLow.frequency, p.radio ? RADIO_LOWPASS_HZ : OPEN_LOWPASS_HZ, instant)
      set(echoLevel.gain, p.echo ? ECHO_LEVEL : 0, instant)
      radioClip.curve = p.radio ? RADIO_CURVE : null
      const message: VoiceModWorkletMessage = { ratio: p.pitchRatio, ringHz: p.ringHz }
      shifter.port.postMessage(message)
    },
    destroy: () => nodes.forEach((node) => node.disconnect())
  }
}
