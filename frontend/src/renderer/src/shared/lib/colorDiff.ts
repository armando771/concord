// Diferença de cor percebida (ΔE CIEDE2000) entre duas cores sRGB. Puro, sem DOM.
// Usado pelo teste que compara o tema Discord Escuro com as cores medidas no
// Discord de verdade: ΔE ≤ 1 é imperceptível, ≤ 2 só se nota lado a lado.

import { composite, parseColor, type Rgba } from './contrast'

export type Lab = [number, number, number]

function toLab({ r, g, b }: Rgba): Lab {
  const lin = (v: number): number => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)]
  const x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
  const z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

const rad = (deg: number): number => (deg * Math.PI) / 180
const deg = (r: number): number => (r * 180) / Math.PI

/** ΔE2000 entre duas cores já opacas. */
export function deltaE2000(a: Rgba, b: Rgba): number {
  return deltaE2000Lab(toLab(a), toLab(b))
}

/** ΔE2000 entre duas cores em CIE L*a*b*. */
export function deltaE2000Lab([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const cMean = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const g = 0.5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)))
  const a1p = (1 + g) * a1
  const a2p = (1 + g) * a2
  const c1 = Math.hypot(a1p, b1)
  const c2 = Math.hypot(a2p, b2)
  const hue = (y: number, x: number): number =>
    x === 0 && y === 0 ? 0 : (deg(Math.atan2(y, x)) + 360) % 360
  const h1 = hue(b1, a1p)
  const h2 = hue(b2, a2p)
  const dL = l2 - l1
  const dC = c2 - c1
  let dh = h2 - h1
  if (c1 * c2 === 0) dh = 0
  else if (dh > 180) dh -= 360
  else if (dh < -180) dh += 360
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(rad(dh / 2))
  const lMean = (l1 + l2) / 2
  const cpMean = (c1 + c2) / 2
  let hMean = h1 + h2
  if (c1 * c2 !== 0) {
    if (Math.abs(h1 - h2) <= 180) hMean /= 2
    else hMean = (hMean + (hMean < 360 ? 360 : -360)) / 2
  }
  const t =
    1 -
    0.17 * Math.cos(rad(hMean - 30)) +
    0.24 * Math.cos(rad(2 * hMean)) +
    0.32 * Math.cos(rad(3 * hMean + 6)) -
    0.2 * Math.cos(rad(4 * hMean - 63))
  const sl = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2)
  const sc = 1 + 0.045 * cpMean
  const sh = 1 + 0.015 * cpMean * t
  const rc = 2 * Math.sqrt(cpMean ** 7 / (cpMean ** 7 + 25 ** 7))
  const rt = -Math.sin(rad(2 * 30 * Math.exp(-(((hMean - 275) / 25) ** 2)))) * rc
  const vl = dL / sl
  const vc = dC / sc
  const vh = dH / sh
  return Math.sqrt(vl * vl + vc * vc + vh * vh + rt * vc * vh)
}

/**
 * ΔE entre duas cores CSS; uma translúcida é composta sobre `base` (como o
 * navegador pinta). Cor que não dá para ler é erro, não "igual".
 */
export function colorDistance(a: string, b: string, base = '#000000'): number {
  const bg = parseColor(base)
  const ca = parseColor(a)
  const cb = parseColor(b)
  if (!bg || !ca || !cb) throw new Error(`cor inválida: ${a} / ${b} / ${base}`)
  return deltaE2000(composite(ca, bg), composite(cb, bg))
}
