// Contas e execução do "Editar imagem" fora do componente: posição da imagem
// no quadro, arrasto e o recorte em si (com o erro virando mensagem).
import { cropMedia } from './cropMedia'
import { clampOffset, coverScale, sourceRect, type Point, type Size } from './imageCrop'
import type { MediaChange } from './profileValidation'

export interface Drag {
  /** Onde o ponteiro estava ao começar. */
  start: Point
  /** Posição da imagem ao começar. */
  from: Point
}

export interface ImagePlacement {
  width: number
  height: number
  left: number
  top: number
}

/** Tamanho e posição da imagem dentro do quadro (centralizada, mais o arrasto). */
export function imagePlacement(
  natural: Size,
  frame: Size,
  zoom: number,
  offset: Point
): ImagePlacement {
  const scale = coverScale(natural, frame) * zoom
  const shown = clampOffset(natural, frame, zoom, offset)
  const width = natural.width * scale
  const height = natural.height * scale
  return {
    width,
    height,
    left: (frame.width - width) / 2 + shown.x,
    top: (frame.height - height) / 2 + shown.y
  }
}

/** Nova posição da imagem enquanto o ponteiro se move. */
export function dragOffset(
  natural: Size,
  frame: Size,
  zoom: number,
  drag: Drag,
  pointer: Point
): Point {
  return clampOffset(natural, frame, zoom, {
    x: drag.from.x + pointer.x - drag.start.x,
    y: drag.from.y + pointer.y - drag.start.y
  })
}

export interface CropRequest {
  file: File
  image: HTMLImageElement
  natural: Size
  frame: Size
  zoom: number
  offset: Point
  out: Size
}

type SetChange = Extract<MediaChange, { kind: 'set' }>

const FALLBACK_ERROR = 'Não foi possível usar essa imagem.'

/** Recorta e entrega o resultado; qualquer falha vira a mensagem de erro. */
export async function runCrop(
  { file, image, natural, frame, zoom, offset, out }: CropRequest,
  onApply: (change: SetChange) => void,
  onError: (message: string) => void
): Promise<void> {
  try {
    onApply(await cropMedia(file, image, sourceRect(natural, frame, zoom, offset), out))
  } catch (err) {
    onError(err instanceof Error ? err.message : FALLBACK_ERROR)
  }
}

/** Respiro das laterais do diálogo em telas estreitas (p-4 do fundo + miolo). */
const SIDE_ROOM = 64

/** Encolhe o quadro, mantendo a proporção, quando a tela não comporta (360 px). */
export function fitFrame(frame: Size, viewportWidth: number): Size {
  const scale = Math.min(1, (viewportWidth - SIDE_ROOM) / frame.width)
  if (scale >= 1) return frame
  return { width: Math.round(frame.width * scale), height: Math.round(frame.height * scale) }
}
