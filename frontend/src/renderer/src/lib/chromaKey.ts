export type RGB = [number, number, number]

export interface ChromaKeyBackground {
  mode: 'color' | 'image'
  /** Cor sólida (#rrggbb) usada no lugar do fundo removido. */
  color: string
  /** Data URL de uma imagem personalizada; vazio quando não há. */
  image: string
}

export interface ChromaKeySettings {
  enabled: boolean
  /** Cor removida do vídeo (#rrggbb). */
  keyColor: string
  /** Sensibilidade 0..1: quão longe da cor-chave ainda é considerado fundo. */
  similarity: number
  /** Suavidade 0..1: largura da borda semitransparente em volta do corpo. */
  smoothness: number
  background: ChromaKeyBackground
}

export const DEFAULT_CHROMA_KEY: ChromaKeySettings = {
  enabled: false,
  keyColor: '#00b140',
  similarity: 0.4,
  smoothness: 0.1,
  background: { mode: 'color', color: '#1e1f22', image: '' }
}

/** Presets de cor-chave mais comuns. */
export const CHROMA_KEY_PRESETS = [
  { label: 'Verde', color: '#00b140' },
  { label: 'Azul', color: '#0047bb' }
] as const

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function hexToRgb(hex: string): RGB | null {
  if (typeof hex !== 'string' || !HEX.test(hex)) return null
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

const clamp01 = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback

const validHex = (v: unknown, fallback: string): string =>
  typeof v === 'string' && HEX.test(v) ? v : fallback

/** Valida o que veio do localStorage (ou da UI) e completa com o padrão. */
export function sanitizeChromaKey(raw: unknown): ChromaKeySettings {
  const d = DEFAULT_CHROMA_KEY
  if (!raw || typeof raw !== 'object') return { ...d, background: { ...d.background } }
  const r = raw as Record<string, unknown>
  const bgRaw =
    r.background && typeof r.background === 'object'
      ? (r.background as Record<string, unknown>)
      : {}
  const image =
    typeof bgRaw.image === 'string' && bgRaw.image.startsWith('data:image/') ? bgRaw.image : ''
  return {
    enabled: r.enabled === true,
    keyColor: validHex(r.keyColor, d.keyColor),
    similarity: clamp01(r.similarity, d.similarity),
    smoothness: clamp01(r.smoothness, d.smoothness),
    background: {
      mode: bgRaw.mode === 'image' && image ? 'image' : 'color',
      color: validHex(bgRaw.color, d.background.color),
      image
    }
  }
}

// Maior distância possível no plano Cb/Cr (~181), para normalizar em 0..1.
const MAX_CHROMA_DIST = 181

function chroma(r: number, g: number, b: number): [number, number] {
  return [128 - 0.168736 * r - 0.331264 * g + 0.5 * b, 128 + 0.5 * r - 0.418688 * g - 0.081312 * b]
}

/**
 * Aplica o chroma key sobre um buffer RGBA, no lugar. O fundo removido vira
 * `bg`: uma cor (RGB) ou um buffer RGBA do mesmo tamanho (imagem). O alfa
 * sai sempre opaco: WebRTC não transporta transparência, então o fundo é
 * composto aqui, no remetente.
 *
 * A distância é medida só em Cb/Cr, ignorando o brilho, para que sombras e
 * dobras do pano não escapem da máscara.
 */
export function applyChromaKey(
  data: Uint8ClampedArray,
  s: ChromaKeySettings,
  bg: RGB | Uint8ClampedArray
): void {
  const key = hexToRgb(s.keyColor)
  if (!key) return
  const [kcb, kcr] = chroma(key[0], key[1], key[2])
  // Distâncias em unidades de Cb/Cr (0..~181); comparadas ao quadrado para
  // só tirar a raiz na faixa de transição (este laço roda ~500 mil vezes por quadro).
  const lo = s.similarity * 0.5 * MAX_CHROMA_DIST
  const band = s.smoothness * 0.5 * MAX_CHROMA_DIST
  const hi = lo + band
  const lo2 = lo * lo
  const hi2 = hi * hi
  // Canal dominante da cor-chave (verde ou azul), para tirar o "vazamento".
  const spillG = key[1] >= key[2]
  const perPixel = !Array.isArray(bg)
  const fr = perPixel ? 0 : bg[0]
  const fg = perPixel ? 0 : bg[1]
  const fb = perPixel ? 0 : bg[2]

  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]
    const dcb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b - kcb
    const dcr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b - kcr
    const d2 = dcb * dcb + dcr * dcr

    let a: number
    if (d2 <= lo2) a = 0
    else if (d2 >= hi2) a = 1
    else {
      const x = (Math.sqrt(d2) - lo) / band
      a = x * x * (3 - 2 * x)
    }

    if (a > 0) {
      if (spillG) {
        const other = (r + b) / 2
        if (g > other) g = other
      } else {
        const other = (r + g) / 2
        if (b > other) b = other
      }
    }

    if (a === 1) {
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
      continue
    }
    const na = 1 - a
    data[i] = r * a + (perPixel ? bg[i] : fr) * na
    data[i + 1] = g * a + (perPixel ? bg[i + 1] : fg) * na
    data[i + 2] = b * a + (perPixel ? bg[i + 2] : fb) * na
    data[i + 3] = 255
  }
}

/** Cor (#rrggbb) do pixel (x, y) de um buffer RGBA de largura `width`; null fora dos limites. */
export function pickKeyColor(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number
): string | null {
  if (x < 0 || y < 0 || x >= width) return null
  const i = (y * width + x) * 4
  if (i + 2 >= data.length) return null
  return rgbToHex([data[i], data[i + 1], data[i + 2]])
}
