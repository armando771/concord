import { routeElementToOutput } from './voiceOutput'

/**
 * Teto do clipe: o backend aceita até 5 s pela duração que o app declara; um
 * arquivo maior do que o declarado é cortado aqui.
 */
export const MAX_ENTRANCE_CLIP_MS = 5_500

/**
 * Toca o som de entrada pela mesma saída das vozes e da mesa de áudio.
 * Resolve true quando começou a tocar e false quando não deu (quem chama toca
 * o som padrão no lugar).
 */
export function playEntranceClip(src: string, volume: number): Promise<boolean> {
  if (typeof Audio === 'undefined') return Promise.resolve(false)
  // CORS: o Web Audio só lê a mídia de outra origem com a requisição anônima.
  const el = new Audio()
  el.crossOrigin = 'anonymous'
  el.src = src
  const route = routeElementToOutput(el, volume)

  let stopped = false
  const stop = (): void => {
    if (stopped) return
    stopped = true
    clearTimeout(timer)
    el.pause()
    route.stop()
  }
  const timer = setTimeout(stop, MAX_ENTRANCE_CLIP_MS)
  el.addEventListener('ended', stop, { once: true })

  return new Promise((resolve) => {
    const fail = (): void => {
      stop()
      resolve(false)
    }
    el.addEventListener('error', fail, { once: true })
    el.play().then(() => resolve(true), fail)
  })
}
