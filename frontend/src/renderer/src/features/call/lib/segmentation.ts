// Peças puras da separação pessoa/fundo (a carga do modelo fica em
// personSegmenter.ts, que importa o WASM). Tudo aqui roda em node nos testes.

/** Teto de pixels processados por quadro (~960x540): mantém o FPS no main thread. */
export const PROCESS_MAX_PIXELS = 518_400

/** Dimensões de saída: as da câmera, reduzidas para caber em PROCESS_MAX_PIXELS. */
export function processingSize(w: number, h: number): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: 640, height: 360 }
  const scale = Math.min(1, Math.sqrt(PROCESS_MAX_PIXELS / (w * h)))
  return { width: Math.max(2, Math.round(w * scale)), height: Math.max(2, Math.round(h * scale)) }
}

// A confiança do modelo é "probabilidade de ser pessoa". Abaixo de LOW é fundo
// de certeza, acima de HIGH é pessoa de certeza; no meio a borda é gradual.
const LOW = 0.3
const HIGH = 0.7

/** Confiança (0..1) → alfa de uma máscara RGBA; só o canal alfa é escrito. */
export function confidenceToAlpha(conf: Float32Array, out: Uint8ClampedArray): void {
  for (let i = 0; i < conf.length; i++) {
    const x = Math.min(1, Math.max(0, (conf[i] - LOW) / (HIGH - LOW)))
    out[i * 4 + 3] = x * x * (3 - 2 * x) * 255
  }
}

/**
 * Encolhe a máscara em 1 px (mínimo 3x3): o modelo marca a borda um pouco para
 * fora da pessoa, e sem isso sobra um contorno do fundo original em volta.
 */
export function erodeMask(
  src: Float32Array,
  dst: Float32Array,
  width: number,
  height: number
): void {
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - 1)
    const y1 = Math.min(height - 1, y + 1)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - 1)
      const x1 = Math.min(width - 1, x + 1)
      let min = 1
      for (let yy = y0; yy <= y1; yy++) {
        const row = yy * width
        for (let xx = x0; xx <= x1; xx++) {
          const v = src[row + xx]
          if (v < min) min = v
        }
      }
      dst[y * width + x] = min
    }
  }
}

/**
 * Mistura a máscara nova com a anterior (média móvel), para a borda não
 * tremer de um quadro para o outro. Altera `prev` e o devolve; se o tamanho
 * mudou (câmera trocada), devolve uma cópia da nova.
 */
export function smoothMask(prev: Float32Array, next: Float32Array, alpha: number): Float32Array {
  if (prev.length !== next.length) return Float32Array.from(next)
  for (let i = 0; i < next.length; i++) prev[i] += (next[i] - prev[i]) * alpha
  return prev
}

/** Retângulo para desenhar uma imagem `iw`x`ih` cobrindo `w`x`h` (corta o excesso, centralizada). */
export function coverRect(
  iw: number,
  ih: number,
  w: number,
  h: number
): { x: number; y: number; w: number; h: number } {
  if (!(iw > 0) || !(ih > 0)) return { x: 0, y: 0, w, h }
  const k = Math.max(w / iw, h / ih)
  const dw = iw * k
  const dh = ih * k
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh }
}

/** Bytes de uma data URL base64 (o modelo entra no bundle como `?inline`). */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma < 0 || !dataUrl.slice(0, comma).endsWith(';base64')) {
    throw new Error('data URL base64 esperada')
  }
  const bin = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
