import workletUrl from './voiceActivityWorklet.ts?worker&url'
import type { MicHandle } from './noiseSuppression'
import { VOICE_ACTIVITY_PROCESSOR } from './voiceActivity'

// Liga a detecção de fala local (voiceActivity.ts) ao microfone da chamada.
//
// Com o RNNoise, roda dentro do próprio AudioContext do microfone
// (MicHandle.watchSpeaking): nenhum contexto novo por chamada ou troca de
// microfone. No fallback do Chromium (sem contexto), usa um AudioContext único
// do app, sem saída (sinkId "none"), reaproveitado entre chamadas e suspenso
// quando ninguém está sendo observado. Nos dois casos o mudo fica com quem
// chama (callStore).

/**
 * Contexto que não sai de "suspended" (política de autoplay sem gesto, ex.:
 * web) nunca mediria nada e deixaria o anel apagado: depois disto, volta ao
 * servidor.
 */
const RESUME_TIMEOUT_MS = 2_000

export interface LocalSpeakingHandlers {
  onChange: (speaking: boolean) => void
  /** Não deu para montar (worklet não carregou etc.): quem chama volta ao servidor. */
  onUnavailable: () => void
}

/** Começa a observar o microfone; devolve a função que para tudo. */
export function watchLocalSpeaking(mic: MicHandle, handlers: LocalSpeakingHandlers): () => void {
  if (mic.watchSpeaking) return watchInMicContext(mic.watchSpeaking, handlers)
  const track = mic.stream.getAudioTracks()[0]
  if (!track) {
    handlers.onUnavailable()
    return () => {}
  }
  return watchInSharedContext(track, handlers)
}

function watchInMicContext(
  watchSpeaking: NonNullable<MicHandle['watchSpeaking']>,
  handlers: LocalSpeakingHandlers
): () => void {
  let stopped = false
  const tap = watchSpeaking((speaking) => {
    if (!stopped) handlers.onChange(speaking)
  })
  tap.ready.catch((err) => {
    if (stopped) return
    console.error('[fala] detecção local indisponível — usando a do servidor:', err)
    stopped = true
    tap.stop()
    handlers.onUnavailable()
  })
  return () => {
    if (stopped) return
    stopped = true
    tap.stop()
  }
}

// ─── Fallback: um AudioContext só, para a vida do app ──────────────────────

let shared: { ctx: AudioContext; module: Promise<void> } | null = null
/** Quantos watches estão usando o contexto compartilhado. */
let sharedUsers = 0

function sharedContext(): { ctx: AudioContext; module: Promise<void> } {
  if (!shared) {
    // sinkId: Chromium 110+; os demais ignoram a opção.
    const ctx = new AudioContext({
      latencyHint: 'interactive',
      sinkId: { type: 'none' }
    } as AudioContextOptions)
    shared = { ctx, module: ctx.audioWorklet.addModule(workletUrl) }
    // Módulo que não carregou: a próxima chamada tenta de novo do zero.
    const current = shared
    current.module.catch(() => {
      if (shared === current) shared = null
      void current.ctx.close().catch(() => {})
    })
  }
  return shared
}

async function resumeWithTimeout(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'running') return
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AudioContext suspenso')), RESUME_TIMEOUT_MS)
  })
  try {
    await Promise.race([ctx.resume(), timeout])
  } finally {
    clearTimeout(timer)
  }
}

function watchInSharedContext(
  track: MediaStreamTrack,
  handlers: LocalSpeakingHandlers
): () => void {
  let context: { ctx: AudioContext; module: Promise<void> }
  try {
    context = sharedContext()
  } catch {
    handlers.onUnavailable()
    return () => {}
  }
  const { ctx } = context
  sharedUsers++
  let stopped = false
  let source: MediaStreamAudioSourceNode | null = null
  let node: AudioWorkletNode | null = null

  const release = (): void => {
    source?.disconnect()
    if (node) {
      node.disconnect()
      node.port.onmessage = null
      node.port.close()
    }
    source = null
    node = null
    sharedUsers--
    // Ninguém mais observando (fim da chamada): o contexto dorme até a próxima.
    if (sharedUsers === 0 && ctx.state === 'running') void ctx.suspend().catch(() => {})
  }

  const setup = async (): Promise<void> => {
    await context.module
    if (stopped) return
    source = ctx.createMediaStreamSource(new MediaStream([track]))
    node = new AudioWorkletNode(ctx, VOICE_ACTIVITY_PROCESSOR, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    })
    node.port.onmessage = (event: MessageEvent<boolean>) => {
      if (!stopped) handlers.onChange(event.data)
    }
    // Ligado ao destino para ser processado em todo navegador (a saída é muda).
    source.connect(node).connect(ctx.destination)
    await resumeWithTimeout(ctx)
  }
  setup().catch((err) => {
    if (stopped) return
    console.error('[fala] detecção local indisponível — usando a do servidor:', err)
    stopped = true
    release()
    handlers.onUnavailable()
  })

  return () => {
    if (stopped) return
    stopped = true
    release()
  }
}
