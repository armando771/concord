// Microfone com supressão de ruído RNNoise (xiph/rnnoise compilado para WASM,
// via @sapphi-red/web-noise-suppressor). Cada microfone aberto tem o próprio
// AudioContext — abrir o teste de microfone não mexe no da chamada.
//
//   mic ─┬─ RNNoise ─ wetGain ─┐
//        └────────── dryGain ──┴─ destino (track enviada)
//
// Ligar/desligar só cruza os ganhos: a track de saída é sempre a mesma, então
// muda ao vivo na chamada sem republicar nada no LiveKit.
//
// A detecção de fala do próprio usuário (voiceActivityWorklet) roda neste
// mesmo contexto, ligada na soma wet+dry (o que vai para o destino), em vez
// de abrir outro AudioContext por chamada/troca de microfone.

import { RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor'
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'
// Inline (data URL): o app empacotado roda em file://, onde fetch não funciona.
import rnnoiseWasmDataUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?inline'
import voiceActivityWorkletUrl from './voiceActivityWorklet.ts?worker&url'
import { VOICE_ACTIVITY_PROCESSOR } from './voiceActivity'
import { useNoiseSuppressionStore } from '../store/noiseSuppressionStore'

/** O RNNoise trabalha em quadros de 10 ms a 48 kHz. */
const SAMPLE_RATE = 48_000
/** Constante de tempo do crossfade ao ligar/desligar. */
const FADE_SECONDS = 0.015

export interface MicHandle {
  /** Stream que vai para a chamada / teste (já processado). */
  stream: MediaStream
  setNoiseSuppression: (on: boolean) => void
  /**
   * Detecção de fala no próprio contexto do microfone (só com o RNNoise; no
   * fallback do Chromium não existe contexto). Antes do `track.enabled`:
   * quem chama aplica o mudo.
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

    const source = ctx.createMediaStreamSource(raw)
    const wet = ctx.createGain()
    const dry = ctx.createGain()
    const destination = ctx.createMediaStreamDestination()
    source.connect(rnnoise).connect(wet).connect(destination)
    source.connect(dry).connect(destination)
    if (ctx.state === 'suspended') await ctx.resume()

    const context = ctx
    const node = rnnoise
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
    apply(useNoiseSuppressionStore.getState().enabled, true)
    useNoiseSuppressionStore.getState().setAvailable(true)

    let stopped = false
    /** O módulo da detecção entra no contexto uma vez só (troca de sala/watch novo reaproveita). */
    let vadModule: Promise<void> | null = null
    const watchSpeaking = (onChange: (speaking: boolean) => void): SpeakingTap => {
      let done = false
      let vad: AudioWorkletNode | null = null
      vadModule ??= context.audioWorklet.addModule(voiceActivityWorkletUrl)
      const ready = vadModule.then(() => {
        if (done || stopped) return
        vad = new AudioWorkletNode(context, VOICE_ACTIVITY_PROCESSOR, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        })
        vad.port.onmessage = (event: MessageEvent<boolean>) => {
          if (!done && !stopped) onChange(event.data)
        }
        // Mesma soma que vai para o destino. A saída do worklet é muda e só
        // vai ao destino para o nó ser processado (puxado pelo grafo).
        wet.connect(vad)
        dry.connect(vad)
        vad.connect(destination)
      })
      return {
        ready,
        stop: () => {
          if (done) return
          done = true
          if (!vad || stopped) return
          wet.disconnect(vad)
          dry.disconnect(vad)
          vad.disconnect()
          vad.port.onmessage = null
          vad.port.close()
        }
      }
    }
    const handle: MicHandle = {
      stream: destination.stream,
      setNoiseSuppression: (on) => {
        if (!stopped) apply(on, false)
      },
      watchSpeaking,
      stop: () => {
        if (stopped) return
        stopped = true
        active.delete(handle)
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
