// Parte do navegador do "Editar imagem": desenha o recorte no canvas e, para
// GIF, decodifica os quadros (WebCodecs) e reescreve o GIF recortado.
import { cropGif, type SourceFrame, type SourceRect } from './gifCrop'
import { coversWhole, gifOutput, type Size } from './imageCrop'
import { MAX_PROFILE_IMAGE_BYTES, type MediaChange } from './profileValidation'

type SetChange = Extract<MediaChange, { kind: 'set' }>

/** Lado maior do quadro parado quando o GIF entra inteiro. */
const WHOLE_STILL_MAX = 680
const FAIL = 'Não foi possível gerar a imagem.'

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(FAIL))), 'image/webp', 0.92)
  })
}

function drawOn(
  source: CanvasImageSource,
  rect: SourceRect,
  out: Size
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = out.width
  canvas.height = out.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error(FAIL)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, out.width, out.height)
  return { canvas, ctx }
}

function pixelsOf(source: CanvasImageSource, rect: SourceRect, out: Size): Uint8ClampedArray {
  return drawOn(source, rect, out).ctx.getImageData(0, 0, out.width, out.height).data
}

/** Quadros do GIF, já compostos, com a duração de cada um. */
async function* gifFrames(file: Blob): AsyncGenerator<SourceFrame> {
  const decoder = new ImageDecoder({ data: await file.arrayBuffer(), type: 'image/gif' })
  await decoder.tracks.ready
  const count = decoder.tracks.selectedTrack?.frameCount ?? 0
  for (let frameIndex = 0; frameIndex < count; frameIndex++) {
    const { image } = await decoder.decode({ frameIndex })
    try {
      yield { image, durationMs: (image.duration ?? 100000) / 1000 }
    } finally {
      image.close()
    }
  }
  decoder.close()
}

/** Primeiro quadro do GIF, na saída (as listas mostram parado e animam no hover). */
async function stillOf(gif: Blob, out: Size): Promise<Blob> {
  const bitmap = await createImageBitmap(gif)
  const whole = { sx: 0, sy: 0, sw: bitmap.width, sh: bitmap.height }
  const { canvas } = drawOn(bitmap, whole, out)
  bitmap.close()
  return canvasBlob(canvas)
}

async function animatedChange(file: Blob, rect: SourceRect, target: Size): Promise<SetChange> {
  const out = gifOutput(rect, target)
  const bytes = await cropGif(gifFrames(file), rect, out, pixelsOf)
  if (bytes.byteLength > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error('O GIF recortado passou de 10 MB. Tente um GIF menor ou mais curto.')
  }
  const gif = new Blob([bytes as BlobPart], { type: 'image/gif' })
  return {
    kind: 'set',
    file: gif,
    staticFrame: await stillOf(gif, out),
    previewUrl: URL.createObjectURL(gif),
    animated: true
  }
}

async function stillChange(
  image: HTMLImageElement,
  rect: SourceRect,
  out: Size
): Promise<SetChange> {
  const blob = await canvasBlob(drawOn(image, rect, out).canvas)
  return { kind: 'set', file: blob, previewUrl: URL.createObjectURL(blob), animated: false }
}

/**
 * O GIF entra inteiro, sem reescrever: quando o recorte pega a imagem toda (o
 * original é menor do que qualquer releitura) ou sem WebCodecs para ler os quadros.
 */
async function wholeGifChange(file: Blob): Promise<SetChange> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, WHOLE_STILL_MAX / Math.max(bitmap.width, bitmap.height))
  const size = {
    width: Math.max(1, Math.round(bitmap.width * scale)),
    height: Math.max(1, Math.round(bitmap.height * scale))
  }
  const whole = { sx: 0, sy: 0, sw: bitmap.width, sh: bitmap.height }
  const staticFrame = await canvasBlob(drawOn(bitmap, whole, size).canvas)
  bitmap.close()
  return { kind: 'set', file, staticFrame, previewUrl: URL.createObjectURL(file), animated: true }
}

/** Resultado do recorte: GIF continua GIF animado; o resto vira WebP. */
export function cropMedia(
  file: File,
  image: HTMLImageElement,
  rect: SourceRect,
  out: Size
): Promise<SetChange> {
  if (file.type !== 'image/gif') return stillChange(image, rect, out)
  const natural = { width: image.naturalWidth, height: image.naturalHeight }
  if (typeof ImageDecoder === 'undefined' || coversWhole(rect, natural)) return wholeGifChange(file)
  return animatedChange(file, rect, out)
}
