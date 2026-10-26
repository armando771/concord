// Microfone com supressão de ruído RNNoise (xiph/rnnoise compilado para WASM,
// via @sapphi-red/web-noise-suppressor). Cada microfone aberto tem o próprio
// AudioContext — abrir o teste de microfone não mexe no da chamada.
//
//   mic ─┬─ RNNoise ─ wetGain ─┐
//        └────────── dryGain ──┴─ entrada ─┬─ detecção/portão ─ destino (track enviada)
//                                          └─ analisador (medidor, mudo)
//
// Ligar/desligar a supressão só cruza os ganhos: a track de saída é sempre a
// mesma, então muda ao vivo na chamada sem republicar nada no LiveKit. O
// volume de entrada e a sensibilidade também mudam ao vivo.
//
// A detecção de fala do próprio usuário (voiceActivityWorklet) roda neste
// mesmo contexto, depois do ganho de entrada: é o portão e o anel verde. Assim
// a sensibilidade e o medidor veem o mesmo sinal que vai para a chamada.

import { RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor'
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'
// Inline (data URL): o app empacotado roda em file://, onde fetch não funciona.
import rnnoiseWasmDataUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?inline'
import voiceActivityWorkletUrl from './voiceActivityWorklet.ts?worker&url'
import {
  rmsDb,
  VOICE_ACTIVITY_PROCESSOR,
  voiceActivityFor,
  type VoiceActivitySettings
} from './voiceActivity'
import { useNoiseSuppressionStore } from '../store/noiseSuppressionStore'
import { useVoiceAudioStore, type VoiceAudioSettings } from '../store/voiceAudioStore'

/** O RNNoise trabalha em quadros de 10 ms a 48 kHz. */
const SAMPLE_RATE = 48_000
/** Constante de tempo do crossfade ao ligar/desligar e ao mexer nos volumes. */
const FADE_SECONDS = 0.015
/** Janela do medidor de nível (~21 ms a 48 kHz). */
const METER_FFT_SIZE = 1024

export type MicVoiceSettings = Pick<
  VoiceAudioSettings,
  'inputVolume' | 'detectionEnabled' | 'sensitivity'
>

export interface MicHandle {
  /** Stream que vai para a chamada / teste (já processado). */
  stream: MediaStream
  setNoiseSuppression: (on: boolean) => void
  /** Volume de entrada e detecção de voz ao vivo (só com o processamento completo). */
  setVoiceAudio?: (settings: MicVoiceSettings) => void
  /** Nível do microfone em dBFS, antes do portão (para o medidor de sensibilidade). */
  readLevel?: () => number
  /**
   * Detecção de fala no próprio contexto do microfone (só com o RNNoise e o
   * worklet de detecção). Antes do `track.enabled`: quem chama aplica o mudo.
   */
  watchSpeaking?: (onChange: (speaking: boolean) => void) => SpeakingTap
  /** Para o microfone de verdade, o RNNoise e o AudioContext. */
  stop: () => void
}

export interface SpeakingTap {
  /** Resolve quando a detecção está rodando; rejeita se o worklet não carregou. */
  ready: Promise<void>
  stop: () => void
}

let wasmBinary: ArrayBuffer | null = null

export function decodeDataUrl(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return bytes.buffer
}

function rnnoiseWasm(): ArrayBuffer {
  wasmBinary ??= decodeDataUrl(rnnoiseWasmDataUrl)
  // O worklet recebe uma cópia (structured clone) — o cache continua inteiro.
  return wasmBinary
}

function captureMic(deviceId: string, browserSuppression: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      echoCancellation: true,
      autoGainControl: true,
      // Com o RNNoise a do Chromium fica desligada (as duas juntas abafam a voz).
      noiseSuppression: browserSuppression,
      channelCount: 1
    },
    video: false
  })
}

const active = new Set<MicHandle>()

// O toggle vale na hora para todo microfone aberto (chamada e teste).
useNoiseSuppressionStore.subscribe((state, prev) => {
  if (state.enabled === prev.enabled) return
  active.forEach((mic) => mic.setNoiseSuppression(state.enabled))
})

useVoiceAudioStore.subscribe((state, prev) => {
  if (
    state.inputVolume === prev.inputVolume &&
    state.detectionEnabled === prev.detectionEnabled &&
    state.sensitivity === prev.sensitivity
  ) {
    return
  }
  active.forEach((mic) => mic.setVoiceAudio?.(state))
})

/**
 * Abre o microfone com o RNNoise no caminho. Se o RNNoise não carregar, libera
 * tudo o que abriu e devolve o microfone com a supressão padrão do Chromium —
 * nunca pior do que sem o RNNoise.
 */
export async function openMicrophone(deviceId = ''): Promise<MicHandle> {
  const raw = await captureMic(deviceId, false)
  let ctx: AudioContext | null = null
  let rnnoise: RnnoiseWorkletNode | null = null
  try {
    ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' })
    await ctx.audioWorklet.addModule(rnnoiseWorkletUrl)
    rnnoise = new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary: rnnoiseWasm() })
    // Microfone estéreo vira mono antes do RNNoise (nenhum canal passa cru).
    rnnoise.channelCount = 1
    rnnoise.channelCountMode = 'explicit'

    // Sem o worklet de detecção o microfone segue: só não há portão nem detecção.
    let vad: AudioWorkletNode | null = null
    try {
      await ctx.audioWorklet.addModule(voiceActivityWorkletUrl)
      vad = new AudioWorkletNode(ctx, VOICE_ACTIVITY_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1]
      })
    } catch (err) {
      console.error('[fala] detecção do microfone indisponível:', err)
    }

    const source = ctx.createMediaStreamSource(raw)
    const wet = ctx.createGain()
    const dry = ctx.createGain()
    const inputGain = ctx.createGain()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = METER_FFT_SIZE
    // O analisador só é processado se estiver ligado ao destino; por isso passa mudo.
    const silent = ctx.createGain()
    silent.gain.value = 0
    const destination = ctx.createMediaStreamDestination()
    source.connect(rnnoise).connect(wet).connect(inputGain)
    source.connect(dry).connect(inputGain)
    if (vad) inputGain.connect(vad).connect(destination)
    else inputGain.connect(destination)
    inputGain.connect(analyser).connect(silent).connect(destination)
    if (ctx.state === 'suspended') await ctx.resume()

    const context = ctx
    const node = rnnoise
    const listeners = new Set<(speaking: boolean) => void>()
    if (vad) {
      vad.port.onmessage = (event: MessageEvent<boolean>) => {
        listeners.forEach((listener) => listener(event.data))
      }
    }

    const apply = (on: boolean, instant: boolean): void => {
      const t = context.currentTime
      for (const [gain, value] of [
        [wet.gain, on ? 1 : 0],
        [dry.gain, on ? 0 : 1]
      ] as const) {
        gain.cancelScheduledValues(t)
        if (instant) gain.setValueAtTime(value, t)
        else gain.setTargetAtTime(value, t, FADE_SECONDS)
      }
    }
    const applyVoice = (settings: MicVoiceSettings, instant: boolean): void => {
      const t = context.currentTime
      inputGain.gain.cancelScheduledValues(t)
      if (instant) inputGain.gain.setValueAtTime(settings.inputVolume, t)
      else inputGain.gain.setTargetAtTime(settings.inputVolume, t, FADE_SECONDS)
      const message: VoiceActivitySettings = {
        config: voiceActivityFor(settings.sensitivity),
        gate: settings.detectionEnabled
      }
      vad?.port.postMessage(message)
    }
    apply(useNoiseSuppressionStore.getState().enabled, true)
    applyVoice(useVoiceAudioStore.getState(), true)
    useNoiseSuppressionStore.getState().setAvailable(true)

    const levels = new Float32Array(analyser.fftSize)
    let stopped = false
    const handle: MicHandle = {
      stream: destination.stream,
      setNoiseSuppression: (on) => {
        if (!stopped) apply(on, false)
      },
      setVoiceAudio: (settings) => {
        if (!stopped) applyVoice(settings, false)
      },
      readLevel: () => {
        analyser.getFloatTimeDomainData(levels)
        let sum = 0
        for (const v of levels) sum += v * v
        return rmsDb(sum, levels.length)
      },
      watchSpeaking: vad
        ? (onChange) => {
            listeners.add(onChange)
            return {
              ready: Promise.resolve(),
              stop: () => {
                listeners.delete(onChange)
              }
            }
          }
        : undefined,
      stop: () => {
        if (stopped) return
        stopped = true
        active.delete(handle)
        listeners.clear()
        raw.getTracks().forEach((t) => t.stop())
        destination.stream.getTracks().forEach((t) => t.stop())
        node.destroy()
        void context.close()
      }
    }
    active.add(handle)
    return handle
  } catch (err) {
    console.error('[RNNoise] não carregou — usando a supressão do Chromium:', err)
    rnnoise?.destroy()
    void ctx?.close()
    raw.getTracks().forEach((t) => t.stop())
    useNoiseSuppressionStore.getState().setAvailable(false)
    const fallback = await captureMic(deviceId, true)
    return {
      stream: fallback,
      setNoiseSuppression: () => {},
      stop: () => fallback.getTracks().forEach((t) => t.stop())
    }
  }
}
