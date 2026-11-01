// Paleta do GIF recortado: mediana de corte sobre amostras de todos os quadros,
// uma paleta só para a animação inteira (evita cintilar entre quadros).

type Color = [number, number, number]

const MAX_COLORS = 255
const MAX_SAMPLES = 40000
/** Abaixo disso o pixel é transparente (o GIF só tem transparência total). */
const OPAQUE = 128

function sampleColors(frames: Uint8ClampedArray[]): Color[] {
  const total = frames.reduce((n, f) => n + f.length / 4, 0)
  const step = Math.max(1, Math.floor(total / MAX_SAMPLES))
  const colors: Color[] = []
  let seen = 0
  for (const data of frames) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] >= OPAQUE && seen++ % step === 0) {
        colors.push([data[i], data[i + 1], data[i + 2]])
      }
    }
  }
  return colors
}

function widestChannel(box: Color[]): number {
  let best = 0
  let bestRange = -1
  for (let c = 0; c < 3; c++) {
    const values = box.map((color) => color[c])
    const range = Math.max(...values) - Math.min(...values)
    if (range > bestRange) {
      best = c
      bestRange = range
    }
  }
  return best
}

function split(box: Color[]): [Color[], Color[]] {
  const channel = widestChannel(box)
  const sorted = [...box].sort((a, b) => a[channel] - b[channel])
  const mid = sorted.length >> 1
  return [sorted.slice(0, mid), sorted.slice(mid)]
}

function average(box: Color[]): Color {
  const sum = box.reduce<Color>((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0])
  return [
    Math.round(sum[0] / box.length),
    Math.round(sum[1] / box.length),
    Math.round(sum[2] / box.length)
  ]
}

/** Até 255 cores representativas dos pixels opacos de todos os quadros. */
export function buildPalette(frames: Uint8ClampedArray[]): Color[] {
  const unique = new Map<number, Color>()
  for (const c of sampleColors(frames)) unique.set((c[0] << 16) | (c[1] << 8) | c[2], c)
  const colors = [...unique.values()]
  if (colors.length <= MAX_COLORS) return colors
  const boxes: Color[][] = [colors]
  while (boxes.length < MAX_COLORS) {
    boxes.sort((a, b) => b.length - a.length)
    if (boxes[0].length < 2) break
    boxes.push(...split(boxes.shift()!))
  }
  return boxes.map(average)
}

/** Cor mais próxima (distância no RGB); a paleta é o índice + 1. */
function nearest(palette: Color[], r: number, g: number, b: number): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i]
    const dist = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2
    if (dist < bestDist) {
      best = i
      bestDist = dist
    }
  }
  return best + 1
}

/** Índices na paleta de cada pixel do quadro; transparente vira 0. */
export function indexPixels(data: Uint8ClampedArray, palette: Color[]): Uint8Array {
  const out = new Uint8Array(data.length / 4)
  const cache = new Map<number, number>()
  for (let i = 0; i < out.length; i++) {
    const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]]
    if (a < OPAQUE) continue
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    let index = cache.get(key)
    if (index === undefined) {
      index = nearest(palette, r, g, b)
      cache.set(key, index)
    }
    out[i] = index
  }
  return out
}
