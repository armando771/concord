// Liga uma cena a um <canvas>: tamanho (ResizeObserver, dpr ≤ 1,5), só anima
// visível na tela e com a aba à mostra, e quadro parado com
// prefers-reduced-motion. Devolve a limpeza. O ambiente vem de fora.
import { createEffectLoop } from './loop'
import type { EffectParams, Rand, Scene } from './types'

export const MAX_DPR = 1.5

export interface MountEnv {
  raf: (cb: (time: number) => void) => number
  caf: (id: number) => void
  dpr: number
  observeSize(el: Element, cb: (w: number, h: number) => void): () => void
  observeVisible(el: Element, cb: (visible: boolean) => void): () => void
  pageHidden(): boolean
  watchPage(cb: (hidden: boolean) => void): () => void
  reducedMotion(): boolean
}

export interface MountOptions {
  scene: Scene
  params: EffectParams
  env: MountEnv
  rand: Rand
}

/** Tamanho de partida antes do primeiro aviso do ResizeObserver. */
function initialSize(canvas: HTMLCanvasElement): [number, number] {
  return [canvas.clientWidth || 300, canvas.clientHeight || 400]
}

export function mountEffect(canvas: HTMLCanvasElement, o: MountOptions): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const dpr = Math.min(MAX_DPR, o.env.dpr || 1)
  const reduced = o.env.reducedMotion()
  const [w0, h0] = initialSize(canvas)
  const { raf, caf } = o.env
  const loop = createEffectLoop({ ...o, ctx, width: w0, height: h0, raf, caf })
  let visible = true
  let hidden = o.env.pageHidden()

  const sync = (): void => {
    if (reduced) return
    if (visible && !hidden) loop.start()
    else loop.stop()
  }
  const fit = (w: number, h: number): void => {
    if (w <= 0 || h <= 0) return
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    loop.resize(w, h)
    if (reduced) loop.renderStill()
  }

  fit(w0, h0)
  sync()
  const offs = [
    o.env.observeSize(canvas, fit),
    o.env.observeVisible(canvas, (v) => {
      visible = v
      sync()
    }),
    o.env.watchPage((hd) => {
      hidden = hd
      sync()
    })
  ]
  return () => {
    loop.stop()
    for (const off of offs) off()
  }
}
