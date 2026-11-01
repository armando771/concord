import { routeElementToOutput } from '../../call/lib/voiceOutput'

/**
 * Toca a fala do Piper (WAV) pela mesma saída das vozes: o dispositivo
 * escolhido em Configurações → Voz e o volume de saída. Devolve o "parar"
 * (não chama onEnd: quem para é a fila, que já seguiu).
 */
export function playWav(wav: Uint8Array, onEnd: () => void): () => void {
  const url = URL.createObjectURL(new Blob([wav as BlobPart], { type: 'audio/wav' }))
  const el = new Audio()
  el.src = url
  const route = routeElementToOutput(el, 1)
  let stopped = false
  const stop = (): void => {
    if (stopped) return
    stopped = true
    el.pause()
    route.stop()
    URL.revokeObjectURL(url)
  }
  const end = (): void => {
    if (stopped) return
    stop()
    onEnd()
  }
  el.addEventListener('ended', end, { once: true })
  el.addEventListener('error', end, { once: true })
  el.play().catch(end)
  return stop
}
