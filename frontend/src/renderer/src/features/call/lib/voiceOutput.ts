// Saída das vozes, das telas e do soundboard: um AudioContext só, no
// dispositivo escolhido em Configurações → Voz. Passa pelo Web Audio para o
// volume de saída chegar a 150% (o volume de um <audio> para em 100%).
// Os sons do app (lib/sounds.ts) continuam no contexto próprio.

import { useVoiceAudioStore } from '../store/voiceAudioStore'

const FADE_SECONDS = 0.015

type SinkContext = AudioContext & { setSinkId?: (id: string) => Promise<void> }

export interface VoiceRoute {
  /** Volume local, de 0 a 1 (da pessoa, da transmissão ou do clipe). */
  setVolume: (volume: number) => void
  stop: () => void
}

interface OpenRoute {
  context: AudioContext
  gain: GainNode
  volume: number
  release: () => void
}

let context: AudioContext | null = null
let sinkId = ''
/** Volume de saída geral (0 a 1,5), aplicado a todas as rotas abertas. */
let master = useVoiceAudioStore.getState().outputVolume
const open = new Set<OpenRoute>()

function output(): AudioContext {
  if (!context) {
    context = new AudioContext()
    void (context as SinkContext).setSinkId?.(sinkId).catch(() => {})
  }
  if (context.state === 'suspended') void context.resume().catch(() => {})
  return context
}

function ramp(route: OpenRoute): void {
  route.gain.gain.setTargetAtTime(route.volume * master, route.context.currentTime, FADE_SECONDS)
}

function connect(
  ctx: AudioContext,
  source: AudioNode,
  volume: number,
  release: () => void
): VoiceRoute {
  const gain = ctx.createGain()
  gain.gain.value = volume * master
  source.connect(gain).connect(ctx.destination)
  const route: OpenRoute = { context: ctx, gain, volume, release }
  open.add(route)
  return {
    setVolume: (next) => {
      route.volume = next
      ramp(route)
    },
    stop: () => {
      open.delete(route)
      release()
      gain.disconnect()
    }
  }
}

/** Toca um fluxo de áudio (a voz ou a tela de alguém) na saída do app. */
export function routeStreamToOutput(stream: MediaStream, volume: number): VoiceRoute {
  const ctx = output()
  const source = ctx.createMediaStreamSource(stream)
  return connect(ctx, source, volume, () => source.disconnect())
}

/** Toca um clipe (elemento de áudio) na saída do app. */
export function routeElementToOutput(el: HTMLMediaElement, volume: number): VoiceRoute {
  const ctx = output()
  const source = ctx.createMediaElementSource(el)
  return connect(ctx, source, volume, () => source.disconnect())
}

/** Dispositivo de saída das vozes e do soundboard ('' = padrão do sistema). */
export function setVoiceOutputDevice(deviceId: string): void {
  sinkId = deviceId
  if (context) void (context as SinkContext).setSinkId?.(deviceId).catch(() => {})
}

function applyOutputVolume(volume: number): void {
  master = volume
  open.forEach(ramp)
}

useVoiceAudioStore.subscribe((state, prev) => {
  if (state.outputVolume !== prev.outputVolume) applyOutputVolume(state.outputVolume)
})
