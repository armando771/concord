import workletUrl from './voiceActivityWorklet.ts?worker&url'

// Liga a detecção de fala local (voiceActivity.ts) a uma track de microfone.
// Usa a track publicada (já com RNNoise e mute aplicados): o anel acende
// para o que os outros de fato ouvem. Contexto de áudio próprio, sem saída
// (sinkId "none"), então não abre dispositivo de som.

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

/** Começa a observar a track; devolve a função que para tudo. */
export function watchLocalSpeaking(
  track: MediaStreamTrack,
  handlers: LocalSpeakingHandlers
): () => void {
  let stopped = false
  let ctx: AudioContext
  try {
    // sinkId: Chromium 110+; os demais ignoram a opção.
    ctx = new AudioContext({
      latencyHint: 'interactive',
      sinkId: { type: 'none' }
    } as AudioContextOptions)
  } catch {
    handlers.onUnavailable()
    return () => {}
  }

  const setup = async (): Promise<void> => {
    await ctx.audioWorklet.addModule(workletUrl)
    if (stopped) return
    const source = ctx.createMediaStreamSource(new MediaStream([track]))
    const node = new AudioWorkletNode(ctx, 'concord-voice-activity', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    })
    node.port.onmessage = (event: MessageEvent<boolean>) => {
      if (!stopped) handlers.onChange(event.data)
    }
    // Ligado ao destino para ser processado em todo navegador (a saída é muda).
    source.connect(node).connect(ctx.destination)
    if (ctx.state !== 'running') {
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
  }
  setup().catch((err) => {
    if (stopped) return
    console.error('[fala] detecção local indisponível — usando a do servidor:', err)
    stopped = true
    void ctx.close().catch(() => {})
    handlers.onUnavailable()
  })

  return () => {
    if (stopped) return
    stopped = true
    void ctx.close().catch(() => {})
  }
}
