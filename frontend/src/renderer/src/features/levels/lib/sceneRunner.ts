import { canvasScale } from '../../call/lib/canvasBudget'
import type { Scene } from './sceneKit'

export interface SceneRun {
  /** Tamanho da tela (CSS px). */
  w: number
  h: number
  durationMs: number
  dpr: number
  /** Durante a call o canvas desenha em 1× (canvasBudget). */
  inCall: boolean
  /** Monta a cena no contexto onde ela vai ser desenhada. */
  build: (ctx: CanvasRenderingContext2D) => Scene
}

/**
 * Toca uma cena num <canvas> em tela cheia: ajusta a resolução (~2 MP no
 * máximo), desenha um quadro por requestAnimationFrame até `durationMs` e
 * para sozinha. Devolve o "parar", que também libera a memória do canvas.
 */
export function runScene(canvas: HTMLCanvasElement, run: SceneRun): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const scale = canvasScale({ dpr: run.dpr, w: run.w, h: run.h, inCall: run.inCall })
  canvas.width = Math.round(run.w * scale)
  canvas.height = Math.round(run.h * scale)
  canvas.dataset.scale = String(scale)
  const scene = run.build(ctx)
  canvas.dataset.particles = String(scene.particles)
  let raf = 0
  let start: number | null = null
  const frame = (now: number): void => {
    start ??= now
    const t = now - start
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, run.w, run.h)
    if (t >= run.durationMs) return // acabou: não pede outro quadro
    scene.draw(ctx, t)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return () => {
    cancelAnimationFrame(raf)
    // Libera a memória do canvas já na desmontagem (sem esperar o GC).
    canvas.width = 0
    canvas.height = 0
  }
}

/** O sistema pediu menos movimento (prefers-reduced-motion). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
