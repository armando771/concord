// GIF de fundo animado. O <img> só anima enquanto a página é pintada, o que não
// vale para um canvas que alimenta uma chamada; então os quadros são
// decodificados uma vez (WebCodecs) e escolhidos pelo relógio a cada desenho.

/** Memória máxima dos quadros decodificados (RGBA). */
export const GIF_MAX_BYTES = 160 * 1024 * 1024
/** Duração mínima de um quadro: GIFs sem tempo (ou 0) tocam a 10 fps. */
const DEFAULT_FRAME_MS = 100
const MIN_FRAME_MS = 20

export interface AnimatedImage {
  width: number
  height: number
  /** Quadro que deve estar na tela em `ms` (o relógio dá voltas pelo GIF). */
  frameAt: (ms: number) => ImageBitmap
  close: () => void
}

/** Índice do quadro mostrado em `ms`, para durações em ms (volta ao início no fim). */
export function frameIndexAt(durations: readonly number[], ms: number): number {
  if (durations.length === 0) return 0
  const total = durations.reduce((a, b) => a + b, 0)
  if (!(total > 0)) return 0
  let t = ((ms % total) + total) % total
  for (let i = 0; i < durations.length; i++) {
    if (t < durations[i]) return i
    t -= durations[i]
  }
  return durations.length - 1
}

/** Duração de um quadro em ms (WebCodecs dá em µs; pode vir nula). */
export function frameDurationMs(microseconds: number | null | undefined): number {
  if (!microseconds || microseconds <= 0) return DEFAULT_FRAME_MS
  return Math.max(MIN_FRAME_MS, Math.round(microseconds / 1000))
}

/** Tamanho dos quadros para `count` deles caberem em `maxBytes` (nunca amplia). */
export function gifFrameSize(
  width: number,
  height: number,
  count: number,
  maxBytes = GIF_MAX_BYTES
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0) || !(count > 0)) return { width: 0, height: 0 }
  const scale = Math.min(1, Math.sqrt(maxBytes / (4 * count * width * height)))
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale))
  }
}

interface DecodedFrame {
  image: VideoFrame
}
interface Decoder {
  tracks: { ready: Promise<unknown>; selectedTrack: { frameCount: number } | null }
  decode: (options: { frameIndex: number }) => Promise<DecodedFrame>
  close: () => void
}
type DecoderCtor = new (init: { data: ArrayBuffer; type: string }) => Decoder

/**
 * Decodifica todos os quadros do GIF. null quando o navegador não tem
 * ImageDecoder ou o arquivo não decodifica (quem chama cai para o <img>).
 */
export async function decodeGif(
  blob: Blob,
  Ctor: DecoderCtor | undefined = (globalThis as { ImageDecoder?: DecoderCtor }).ImageDecoder
): Promise<AnimatedImage | null> {
  if (!Ctor || typeof createImageBitmap !== 'function') return null
  let decoder: Decoder | null = null
  const bitmaps: ImageBitmap[] = []
  try {
    decoder = new Ctor({ data: await blob.arrayBuffer(), type: 'image/gif' })
    await decoder.tracks.ready
    const count = decoder.tracks.selectedTrack?.frameCount ?? 0
    if (count < 1) return null
    const durations: number[] = []
    let size = { width: 0, height: 0 }
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i })
      if (i === 0) {
        size = gifFrameSize(image.displayWidth, image.displayHeight, count)
      }
      durations.push(frameDurationMs(image.duration))
      bitmaps.push(
        await createImageBitmap(image, { resizeWidth: size.width, resizeHeight: size.height })
      )
      image.close()
    }
    decoder.close()
    decoder = null
    return {
      width: size.width,
      height: size.height,
      frameAt: (ms) => bitmaps[frameIndexAt(durations, ms)],
      close: () => bitmaps.forEach((b) => b.close())
    }
  } catch {
    bitmaps.forEach((b) => b.close())
    decoder?.close()
    return null
  }
}
