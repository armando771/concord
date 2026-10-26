import { encodeGif } from './gifEncoder'
import { buildPalette, indexPixels } from './gifQuantize'
import type { Size } from './imageCrop'

export interface SourceFrame {
  image: CanvasImageSource
  durationMs: number
}

export interface SourceRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/** Desenha o pedaço do quadro na saída e devolve os pixels RGBA. */
export type DrawFrame = (image: CanvasImageSource, rect: SourceRect, out: Size) => Uint8ClampedArray

/** Teto de quadros: cada um fica em memória até a paleta ser montada. */
export const MAX_GIF_FRAMES = 300

/**
 * Recorta e redimensiona todos os quadros de um GIF e escreve outro GIF,
 * mantendo a animação e o tempo de cada quadro.
 */
export async function cropGif(
  frames: AsyncIterable<SourceFrame>,
  rect: SourceRect,
  out: Size,
  draw: DrawFrame
): Promise<Uint8Array> {
  const pixels: Uint8ClampedArray[] = []
  const delays: number[] = []
  for await (const frame of frames) {
    if (pixels.length >= MAX_GIF_FRAMES) {
      throw new Error(`Esse GIF tem quadros demais (o máximo é ${MAX_GIF_FRAMES}).`)
    }
    pixels.push(draw(frame.image, rect, out))
    delays.push(frame.durationMs)
  }
  if (pixels.length === 0) throw new Error('Não foi possível ler os quadros desse GIF.')
  const palette = buildPalette(pixels)
  return encodeGif({
    width: out.width,
    height: out.height,
    palette,
    frames: pixels.map((data, i) => ({ indices: indexPixels(data, palette), delayMs: delays[i] }))
  })
}
