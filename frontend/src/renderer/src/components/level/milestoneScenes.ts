import { RAINBOW, type MilestoneKind } from '../../lib/levels'

/**
 * Cenas das animações de marco (10, 20 … 100), desenhadas num <canvas> só
 * (sem um nó de DOM por partícula). Cada cena recebe o tamanho da janela e
 * quantas partículas pode usar (levelUpEffects.milestoneParticles) e devolve
 * uma função que desenha o quadro do instante `t` (ms desde o começo).
 */
export interface SceneInput {
  w: number
  h: number
  /** Nível redondo do marco (o número desenhado). */
  level: number
  /** Cor principal e escura da faixa. */
  color: string
  accent: string
  /** Cores das partículas (levelPalette). */
  colors: string[]
  /** Quantas partículas a cena pode criar. */
  budget: number
  /** Força do nível (levelIntensity.power): espalha mais no alto. */
  power: number
  durationMs: number
  /** Tamanho da fonte do número (o mesmo do título em DOM). */
  fontPx: number
  /** Centro da cena (o número fica aqui). */
  cx: number
  cy: number
}

export interface Scene {
  draw: (ctx: CanvasRenderingContext2D, t: number) => void
  /** Partículas criadas (nunca passa do budget). */
  particles: number
}

// ---------- utilidades ----------

/** Aleatório com semente: a mesma cena sai igual toda vez. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = a
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
/** Progresso 0–1 de `t` entre `a` e `b`. */
const prog = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a))
const easeOut = (x: number): number => 1 - (1 - x) ** 3
const easeIn = (x: number): number => x * x * x
const easeInOut = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const easeOutBack = (x: number): number => {
  const c = 1.7
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2
}
/** Sobe de 0 a 1 em [a, b] e volta a 0 em [c, d]. */
const window4 = (t: number, a: number, b: number, c: number, d: number): number =>
  Math.min(prog(t, a, b), 1 - prog(t, c, d))

function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16
  )
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp01(alpha).toFixed(3)})`
}

/** Brilho redondo pré-desenhado por cor (drawImage é bem mais leve que shadowBlur). */
const sprites = new Map<string, HTMLCanvasElement>()
function glow(color: string): HTMLCanvasElement {
  let c = sprites.get(color)
  if (c) return c
  c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, hexA('#ffffff', 1))
  grad.addColorStop(0.18, hexA(color, 0.95))
  grad.addColorStop(0.5, hexA(color, 0.3))
  grad.addColorStop(1, hexA(color, 0))
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  sprites.set(color, c)
  return c
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  r: number,
  alpha: number
): void {
  if (alpha <= 0.002 || r <= 0.5) return
  ctx.globalAlpha = clamp01(alpha)
  ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2)
  ctx.globalAlpha = 1
}

/** Estrelinha de 4 pontas (brilho de cristal / estrela). */
function sparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
  rot = 0
): void {
  if (alpha <= 0.002 || r <= 0.3) return
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.globalAlpha = clamp01(alpha)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, -r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.quadraticCurveTo(0, 0, 0, r)
  ctx.quadraticCurveTo(0, 0, -r, 0)
  ctx.quadraticCurveTo(0, 0, 0, -r)
  ctx.fill()
  ctx.restore()
}

/** Desenha o número numa tela escondida e devolve pontos dentro dele. */
function textPoints(
  text: string,
  fontPx: number,
  count: number,
  cx: number,
  cy: number,
  mode: 'fill' | 'outline'
): { x: number; y: number }[] {
  if (count <= 0) return []
  const pad = Math.ceil(fontPx * 0.1)
  const c = document.createElement('canvas')
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return []
  g.font = `900 ${fontPx}px system-ui, sans-serif`
  const width = Math.ceil(g.measureText(text).width) + pad * 2
  c.width = width
  c.height = Math.ceil(fontPx * 1.1) + pad * 2
  g.font = `900 ${fontPx}px system-ui, sans-serif`
  g.textBaseline = 'middle'
  g.textAlign = 'center'
  g.fillStyle = '#fff'
  g.fillText(text, c.width / 2, c.height / 2)
  const data = g.getImageData(0, 0, c.width, c.height).data
  const on = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < c.width && y < c.height && data[(y * c.width + x) * 4 + 3] > 128
  const step = Math.max(2, Math.round(fontPx / 40))
  const found: { x: number; y: number }[] = []
  for (let y = 0; y < c.height; y += step) {
    for (let x = 0; x < c.width; x += step) {
      if (!on(x, y)) continue
      if (mode === 'outline') {
        const edge = !on(x - step, y) || !on(x + step, y) || !on(x, y - step) || !on(x, y + step)
        if (!edge) continue
      }
      found.push({ x: x - c.width / 2 + cx, y: y - c.height / 2 + cy })
    }
  }
  if (found.length <= count) return found
  // Pega pontos espalhados por igual (não os primeiros da varredura).
  const out: { x: number; y: number }[] = []
  const stride = found.length / count
  for (let i = 0; i < count; i++) out.push(found[Math.floor(i * stride)])
  return out
}

/** Ordena os pontos como um caminho (vizinho mais próximo), para ligar as estrelas. */
function pathOrder(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 3) return points
  const left = points.slice()
  left.sort((a, b) => a.x - b.x)
  const out = [left.shift()!]
  while (left.length) {
    const last = out[out.length - 1]
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < left.length; i++) {
      const d = (left[i].x - last.x) ** 2 + (left[i].y - last.y) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    out.push(left.splice(best, 1)[0])
  }
  return out
}

/** Escurece/apaga tudo no fim da cena. */
const tailFade = (t: number, d: number): number => 1 - prog(t, d * 0.82, d)

// ---------- cenas ----------

type Builder = (s: SceneInput, r: () => number) => Scene

/** 10 · Prata: chuva de moedas girando, algumas estouram do centro. */
const coins: Builder = (s, r) => {
  const n = s.budget
  const size = 9 + 5 * s.power
  const g = 0.0018 * s.h
  const list = Array.from({ length: n }, (_, i) => {
    const burst = i % 3 === 0
    const a = -Math.PI / 2 + (r() - 0.5) * 2.2
    const v = (0.4 + r() * 0.4) * (0.9 + s.power * 0.3)
    return {
      burst,
      x0: burst ? s.cx : r() * s.w,
      y0: burst ? s.cy : -30 - r() * s.h * 0.6,
      vx: burst ? Math.cos(a) * v : (r() - 0.5) * 0.08,
      vy: burst ? Math.sin(a) * v : 0.15 + r() * 0.25,
      g: burst ? g : g * 0.25,
      delay: burst ? r() * 180 : r() * 900,
      spin: 0.006 + r() * 0.012,
      phase: r() * Math.PI * 2,
      size: size * (0.75 + r() * 0.5),
      color: s.colors[i % s.colors.length]
    }
  })
  return {
    particles: n,
    draw(ctx, t) {
      const fade = tailFade(t, s.durationMs)
      drawGlow(ctx, s.color, s.cx, s.cy, 220 + 120 * s.power, window4(t, 0, 120, 200, 900) * 0.7)
      for (const c of list) {
        const lt = t - c.delay
        if (lt < 0) continue
        const x = c.x0 + c.vx * lt
        const y = c.y0 + c.vy * lt + 0.5 * c.g * (lt / 1000) ** 2 * 1000
        if (y > s.h + 40) continue
        const flip = Math.cos(c.phase + lt * c.spin)
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(Math.max(0.12, Math.abs(flip)), 1)
        ctx.globalAlpha = fade
        ctx.beginPath()
        ctx.arc(0, 0, c.size, 0, Math.PI * 2)
        ctx.fillStyle = flip > 0 ? c.color : s.accent
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = 'rgba(255,255,255,.85)'
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, 0, c.size * 0.55, 0, Math.PI * 2)
        ctx.strokeStyle = hexA(s.accent, 0.8)
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()
        // Brilho que passa na moeda quando ela fica de frente.
        if (flip > 0.92) sparkle(ctx, x - c.size * 0.3, y - c.size * 0.3, c.size, '#fff', fade)
      }
    }
  }
}

/** 20 · Ouro: anéis de choque dourados, raios e faíscas surfando a onda. */
const shockwave: Builder = (s, r) => {
  const n = s.budget
  const maxR = Math.hypot(s.w, s.h) * 0.62
  const rings = [0, 160, 330, 520]
  const sparks = Array.from({ length: n }, (_, i) => ({
    a: (i / n) * Math.PI * 2 + r() * 0.2,
    k: 0.75 + r() * 0.35,
    ring: i % 2,
    color: s.colors[i % s.colors.length],
    size: 2 + r() * 2.5
  }))
  const ringR = (t: number, start: number): number =>
    maxR * easeOut(prog(t, start + 100, start + 1500))
  return {
    particles: n,
    draw(ctx, t) {
      const fade = tailFade(t, s.durationMs)
      ctx.globalCompositeOperation = 'lighter'
      drawGlow(ctx, s.color, s.cx, s.cy, 160 + 160 * s.power, window4(t, 0, 90, 120, 700))
      // Raios de luz girando.
      const ra = window4(t, 0, 200, 900, 1800) * 0.22
      if (ra > 0) {
        ctx.save()
        ctx.translate(s.cx, s.cy)
        ctx.rotate(t * 0.0004)
        ctx.fillStyle = hexA(s.color, ra)
        for (let i = 0; i < 14; i++) {
          ctx.rotate((Math.PI * 2) / 14)
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(maxR, -maxR * 0.06)
          ctx.lineTo(maxR, maxR * 0.06)
          ctx.fill()
        }
        ctx.restore()
      }
      rings.forEach((start, i) => {
        const p = prog(t, start + 100, start + 1500)
        if (p <= 0 || p >= 1) return
        const radius = ringR(t, start)
        ctx.beginPath()
        ctx.arc(s.cx, s.cy, radius, 0, Math.PI * 2)
        ctx.lineWidth = (18 - i * 3) * (1 - p) + 1
        ctx.strokeStyle = hexA(i % 2 ? '#ffffff' : s.color, (1 - p) * 0.9 * fade)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(s.cx, s.cy, radius * 0.96, 0, Math.PI * 2)
        ctx.lineWidth = 2
        ctx.strokeStyle = hexA(s.accent, (1 - p) * 0.6 * fade)
        ctx.stroke()
      })
      for (const sp of sparks) {
        const start = rings[sp.ring]
        const p = prog(t, start + 100, start + 1500)
        if (p <= 0 || p >= 1) continue
        const d = ringR(t, start) * sp.k
        const d0 = ringR(t - 40, start) * sp.k
        const x = s.cx + Math.cos(sp.a) * d
        const y = s.cy + Math.sin(sp.a) * d
        ctx.beginPath()
        ctx.moveTo(s.cx + Math.cos(sp.a) * d0, s.cy + Math.sin(sp.a) * d0)
        ctx.lineTo(x, y)
        ctx.lineWidth = sp.size
        ctx.strokeStyle = hexA(sp.color, (1 - p) * fade)
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'source-over'
    }
  }
}

/** 30 · Esmeralda: vinhas crescem dos cantos, brotam folhas e o vento as varre. */
const vines: Builder = (s, r) => {
  const { w, h } = s
  type P = [number, number]
  const curves: [P, P, P, P][] = [
    [
      [-20, h + 20],
      [w * 0.15, h * 0.35],
      [w * 0.35, h * 0.85],
      [w * 0.48, h * 0.2]
    ],
    [
      [w + 20, h + 20],
      [w * 0.85, h * 0.4],
      [w * 0.62, h * 0.9],
      [w * 0.54, h * 0.18]
    ],
    [
      [-20, h * 0.3],
      [w * 0.2, h * 0.1],
      [w * 0.25, h * 0.6],
      [w * 0.4, h * 0.5]
    ],
    [
      [w + 20, h * 0.35],
      [w * 0.8, h * 0.12],
      [w * 0.75, h * 0.62],
      [w * 0.6, h * 0.52]
    ]
  ]
  const bez = (c: [P, P, P, P], u: number): P => {
    const m = 1 - u
    return [
      m * m * m * c[0][0] + 3 * m * m * u * c[1][0] + 3 * m * u * u * c[2][0] + u * u * u * c[3][0],
      m * m * m * c[0][1] + 3 * m * m * u * c[1][1] + 3 * m * u * u * c[2][1] + u * u * u * c[3][1]
    ]
  }
  const grow = (t: number, i: number): number => easeInOut(prog(t, i * 120, 1300 + i * 120))
  const n = s.budget
  const leaves = Array.from({ length: n }, (_, i) => {
    const vine = i % curves.length
    const u = 0.08 + r() * 0.9
    const [x, y] = bez(curves[vine], u)
    const [x2, y2] = bez(curves[vine], Math.min(1, u + 0.01))
    return {
      vine,
      u,
      x,
      y,
      tangent: Math.atan2(y2 - y, x2 - x),
      side: i % 2 ? 1 : -1,
      size: 7 + r() * 7 + s.power * 4,
      vx: 0.35 + r() * 0.5,
      vy: -0.05 - r() * 0.15,
      wob: r() * Math.PI * 2,
      spin: (r() - 0.5) * 0.01,
      release: 1900 + r() * 500,
      color: r() < 0.7 ? s.color : s.colors[i % s.colors.length]
    }
  })
  return {
    particles: n,
    draw(ctx, t) {
      const fade = tailFade(t, s.durationMs)
      const vineAlpha = 1 - prog(t, 2100, 2900)
      ctx.lineCap = 'round'
      curves.forEach((c, i) => {
        const g = grow(t, i)
        if (g <= 0 || vineAlpha <= 0) return
        const steps = 40
        let prev = bez(c, 0)
        for (let k = 1; k <= steps * g; k++) {
          const p = bez(c, k / steps)
          ctx.beginPath()
          ctx.moveTo(prev[0], prev[1])
          ctx.lineTo(p[0], p[1])
          ctx.lineWidth = 9 * (1 - k / steps) + 2
          ctx.strokeStyle = hexA(k % 2 ? s.accent : s.color, 0.9 * vineAlpha)
          ctx.stroke()
          prev = p
        }
        // Gavinha enrolando na ponta.
        const tip = bez(c, g)
        ctx.beginPath()
        for (let k = 0; k < 16; k++) {
          const a = k * 0.5
          const rad = 14 * (1 - k / 16)
          ctx.lineTo(tip[0] + Math.cos(a) * rad, tip[1] + Math.sin(a) * rad)
        }
        ctx.lineWidth = 2
        ctx.strokeStyle = hexA(s.color, vineAlpha * 0.8)
        ctx.stroke()
      })
      for (const l of leaves) {
        const g = grow(t, l.vine)
        if (g < l.u) continue
        const pop = easeOutBack(clamp01((g - l.u) * 12))
        const lt = Math.max(0, t - l.release)
        const x = l.x + l.vx * lt + Math.sin(l.wob + lt * 0.004) * 18 * Math.min(1, lt / 400)
        const y = l.y + l.vy * lt + Math.cos(l.wob + lt * 0.003) * 10 * Math.min(1, lt / 400)
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(l.tangent + l.side * 1.1 + l.spin * lt)
        ctx.scale(pop, pop)
        ctx.globalAlpha = fade
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(l.size * 0.6, -l.size * 0.45, l.size * 1.4, 0)
        ctx.quadraticCurveTo(l.size * 0.6, l.size * 0.45, 0, 0)
        ctx.fillStyle = l.color
        ctx.fill()
        ctx.strokeStyle = hexA(s.accent, 0.9)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(l.size * 1.2, 0)
        ctx.stroke()
        ctx.restore()
      }
      // Rajada de vento verde atravessando.
      const sweep = prog(t, 1900, 3000)
      if (sweep > 0 && sweep < 1) {
        const x = -s.w * 0.3 + sweep * s.w * 1.6
        const grad = ctx.createLinearGradient(x - 200, 0, x + 200, 0)
        grad.addColorStop(0, hexA(s.color, 0))
        grad.addColorStop(0.5, hexA(s.color, 0.16 * fade))
        grad.addColorStop(1, hexA(s.color, 0))
        ctx.fillStyle = grad
        ctx.fillRect(x - 200, 0, 400, s.h)
      }
    }
  }
}

/** 40 · Safira: uma gota cai no meio, espirra e a água ondula com bolhas. */
const ripple: Builder = (s, r) => {
  const impact = 460
  const splashN = Math.floor(s.budget * 0.35)
  const bubbleN = s.budget - splashN
  const maxR = Math.max(s.w, s.h) * 0.75
  const splash = Array.from({ length: splashN }, () => {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.4
    const v = 0.35 + r() * 0.55
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 2 + r() * 3 }
  })
  const bubbles = Array.from({ length: bubbleN }, () => ({
    x: r() * s.w,
    y0: s.h + 20 + r() * 80,
    v: 0.18 + r() * 0.3,
    wob: r() * Math.PI * 2,
    size: 3 + r() * 7,
    delay: impact + r() * 1400
  }))
  const waves = [0, 220, 440, 660, 880, 1500, 1700]
  return {
    particles: s.budget,
    draw(ctx, t) {
      const fade = tailFade(t, s.durationMs)
      // Tinta azul funda na tela.
      const tint = window4(t, 0, 400, 2200, s.durationMs) * 0.32
      if (tint > 0) {
        const grad = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, maxR)
        grad.addColorStop(0, hexA(s.color, tint * 0.6))
        grad.addColorStop(1, hexA(s.accent, tint))
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, s.w, s.h)
      }
      // Gota caindo.
      if (t < impact) {
        const p = easeIn(t / impact)
        const y = -40 + (s.cy + 40) * p
        ctx.save()
        ctx.translate(s.cx, y)
        ctx.scale(1, 1.6)
        ctx.beginPath()
        ctx.arc(0, 0, 9, 0, Math.PI * 2)
        ctx.fillStyle = hexA('#ffffff', 0.95)
        ctx.fill()
        ctx.restore()
        drawGlow(ctx, s.color, s.cx, y, 40, 0.8)
      }
      // Gota menor que volta a cair (segunda ondulação).
      const bounce = prog(t, 900, 1500)
      if (bounce > 0 && bounce < 1) {
        const y = s.cy - Math.sin(bounce * Math.PI) * 120
        ctx.beginPath()
        ctx.arc(s.cx, y, 6, 0, Math.PI * 2)
        ctx.fillStyle = hexA('#ffffff', 0.9 * fade)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'lighter'
      drawGlow(
        ctx,
        s.color,
        s.cx,
        s.cy,
        180 + 100 * s.power,
        window4(t, impact, impact + 80, impact + 100, impact + 700)
      )
      waves.forEach((d, i) => {
        const start = impact + d
        const p = prog(t, start, start + 1800)
        if (p <= 0 || p >= 1) return
        const rx = maxR * easeOut(p) * (i >= 5 ? 0.6 : 1)
        const a = (1 - p) * fade
        for (const [k, col, lw] of [
          [1, s.color, 5],
          [0.94, '#ffffff', 2],
          [0.86, s.accent, 3]
        ] as const) {
          ctx.beginPath()
          ctx.ellipse(s.cx, s.cy, rx * k, rx * k * 0.36, 0, 0, Math.PI * 2)
          ctx.lineWidth = lw * (1 - p) + 0.5
          ctx.strokeStyle = hexA(col, a * 0.9)
          ctx.stroke()
        }
      })
      ctx.globalCompositeOperation = 'source-over'
      for (const d of splash) {
        const lt = t - impact
        if (lt < 0 || lt > 1100) continue
        const x = s.cx + d.vx * lt
        const y = s.cy + d.vy * lt + 0.0009 * lt * lt
        ctx.beginPath()
        ctx.arc(x, y, d.size, 0, Math.PI * 2)
        ctx.fillStyle = hexA('#ffffff', (1 - lt / 1100) * 0.95)
        ctx.fill()
      }
      for (const b of bubbles) {
        const lt = t - b.delay
        if (lt < 0) continue
        const y = b.y0 - b.v * lt
        if (y < -20) continue
        const x = b.x + Math.sin(b.wob + lt * 0.006) * 10
        ctx.beginPath()
        ctx.arc(x, y, b.size, 0, Math.PI * 2)
        ctx.lineWidth = 1.5
        ctx.strokeStyle = hexA('#ffffff', 0.7 * fade)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x - b.size * 0.35, y - b.size * 0.35, b.size * 0.25, 0, Math.PI * 2)
        ctx.fillStyle = hexA('#ffffff', 0.8 * fade)
        ctx.fill()
      }
    }
  }
}

/** 50 · Ametista: cristais voam das bordas e montam o número, brilham e estilhaçam. */
const crystals: Builder = (s, r) => {
  const glintN = Math.min(10, Math.floor(s.budget * 0.15))
  const targets = textPoints(String(s.level), s.fontPx, s.budget - glintN, s.cx, s.cy, 'outline')
  const far = Math.hypot(s.w, s.h) * 0.6
  const shards = targets.map((p, i) => {
    const a = r() * Math.PI * 2
    return {
      tx: p.x,
      ty: p.y,
      sx: s.cx + Math.cos(a) * far,
      sy: s.cy + Math.sin(a) * far,
      rot0: (r() - 0.5) * 8,
      rot: (r() - 0.5) * 0.6,
      size: s.fontPx * (0.045 + r() * 0.035),
      delay: (i / Math.max(1, targets.length)) * 700 + r() * 150,
      vx: (p.x - s.cx) * 0.004 + (r() - 0.5) * 0.4,
      vy: (p.y - s.cy) * 0.004 - r() * 0.3,
      spin: (r() - 0.5) * 0.02,
      color: s.colors[i % s.colors.length]
    }
  })
  const glints = Array.from({ length: glintN }, () => ({
    x: s.cx + (r() - 0.5) * s.fontPx * 2.2,
    y: s.cy + (r() - 0.5) * s.fontPx * 1.1,
    t0: 1200 + r() * 1400,
    size: 8 + r() * 10
  }))
  const shatter = s.durationMs * 0.7
  return {
    particles: shards.length + glints.length,
    draw(ctx, t) {
      const fade = tailFade(t, s.durationMs)
      drawGlow(
        ctx,
        s.color,
        s.cx,
        s.cy,
        s.fontPx * 1.6,
        window4(t, 600, 1400, shatter, shatter + 300) * 0.55
      )
      // Vidro de ametista preenchendo o número quando os cristais chegam.
      const glass = window4(t, 1000, 1700, shatter - 100, shatter + 150) * fade
      if (glass > 0) {
        ctx.save()
        ctx.font = `900 ${s.fontPx}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const grad = ctx.createLinearGradient(0, s.cy - s.fontPx / 2, 0, s.cy + s.fontPx / 2)
        grad.addColorStop(0, hexA('#ffffff', 0.55 * glass))
        grad.addColorStop(0.5, hexA(s.color, 0.5 * glass))
        grad.addColorStop(1, hexA(s.accent, 0.6 * glass))
        ctx.fillStyle = grad
        ctx.fillText(String(s.level), s.cx, s.cy)
        ctx.restore()
      }
      const band = prog(t, 1500, 2300) // brilho que atravessa o número
      const bandX = s.cx - s.fontPx * 1.5 + band * s.fontPx * 3
      for (const sh of shards) {
        const p = easeOutBack(prog(t, sh.delay, sh.delay + 900))
        if (p <= 0) continue
        let x = sh.sx + (sh.tx - sh.sx) * p
        let y = sh.sy + (sh.ty - sh.sy) * p
        let rot = sh.rot0 + (sh.rot - sh.rot0) * Math.min(1, p)
        const lt = t - shatter
        if (lt > 0) {
          x += sh.vx * lt
          y += sh.vy * lt + 0.0006 * lt * lt
          rot += sh.spin * lt
        }
        const lit = band > 0 && band < 1 && Math.abs(x + (y - s.cy) * 0.5 - bandX) < s.fontPx * 0.25
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(rot)
        ctx.globalAlpha = fade * Math.min(1, p * 2)
        ctx.beginPath()
        ctx.moveTo(0, -sh.size)
        ctx.lineTo(sh.size * 0.6, sh.size * 0.2)
        ctx.lineTo(0, sh.size * 0.9)
        ctx.lineTo(-sh.size * 0.6, sh.size * 0.1)
        ctx.closePath()
        ctx.fillStyle = lit ? '#ffffff' : sh.color
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(255,255,255,.7)'
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, -sh.size)
        ctx.lineTo(0, sh.size * 0.9)
        ctx.strokeStyle = hexA(s.accent, 0.8)
        ctx.stroke()
        ctx.restore()
      }
      for (const g of glints) {
        const a = window4(t, g.t0, g.t0 + 150, g.t0 + 200, g.t0 + 600)
        sparkle(ctx, g.x, g.y, g.size, '#ffffff', a * fade, t * 0.003)
      }
    }
  }
}

/** 60 · Rubi: explosão de fogo no centro, labaredas subindo e brasas flutuando. */
const fire: Builder = (s, r) => {
  const flameN = Math.floor(s.budget * 0.55)
  const emberN = s.budget - flameN
  const fireColors = ['#fff3b0', '#fbbf24', '#f97316', s.color, s.accent]
  const flames = Array.from({ length: flameN }, () => ({
    a: -Math.PI / 2 + (r() - 0.5) * 1.6,
    v: 0.3 + r() * 0.45,
    life: 700 + r() * 600,
    offset: r() * 1100,
    size: 30 + r() * 40 + s.power * 20,
    wob: r() * Math.PI * 2
  }))
  const embers = Array.from({ length: emberN }, () => {
    const a = r() * Math.PI * 2
    const v = 0.5 + r() * 0.8
    return {
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      rise: 0.08 + r() * 0.12,
      wob: r() * Math.PI * 2,
      size: 1.5 + r() * 2.5,
      life: 1800 + r() * 1200,
      color: fireColors[Math.floor(r() * 3)]
    }
  })
  // As labaredas sobem de baixo do número, atravessando ele.
  const baseY = s.cy + s.fontPx * 0.5
  const colorAt = (k: number): string =>
    fireColors[Math.min(fireColors.length - 1, Math.floor(k * fireColors.length))]
  return {
    particles: s.budget,
    draw(ctx, t) {
      const fade = tailFade(t, s.durationMs)
      // Calor no fundo.
      const heat = window4(t, 0, 200, 1400, 2600) * 0.35
      if (heat > 0) {
        const grad = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, Math.max(s.w, s.h) * 0.7)
        grad.addColorStop(0, hexA(s.color, heat))
        grad.addColorStop(0.5, hexA(s.accent, heat * 0.5))
        grad.addColorStop(1, hexA(s.accent, 0))
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, s.w, s.h)
      }
      ctx.globalCompositeOperation = 'lighter'
      drawGlow(ctx, '#fbbf24', s.cx, s.cy, 260 + 140 * s.power, window4(t, 0, 80, 100, 600))
      // Anel de choque rubi.
      const ring = prog(t, 60, 900)
      if (ring > 0 && ring < 1) {
        ctx.beginPath()
        ctx.arc(s.cx, s.cy, easeOut(ring) * Math.max(s.w, s.h) * 0.5, 0, Math.PI * 2)
        ctx.lineWidth = 10 * (1 - ring) + 1
        ctx.strokeStyle = hexA(s.color, 1 - ring)
        ctx.stroke()
      }
      // Labaredas: cada uma nasce de novo no centro enquanto o fogo dura.
      const burning = 1 - prog(t, 1400, 2200)
      for (const f of flames) {
        if (t < f.offset * 0.15) continue
        const lt = (t + f.offset) % f.life
        const k = lt / f.life
        const d = f.v * lt
        const x = s.cx + Math.cos(f.a) * d * 1.3 + Math.sin(f.wob + t * 0.01) * 6
        const y = baseY + Math.sin(f.a) * d - 0.00025 * lt * lt
        drawGlow(ctx, colorAt(k), x, y, f.size * (1 - k * 0.7), (1 - k) * 0.85 * burning)
      }
      for (const e of embers) {
        const lt = t - 80
        if (lt < 0 || lt > e.life) continue
        const drag = 1 - Math.exp(-lt / 350)
        const x = s.cx + e.vx * 350 * drag + Math.sin(e.wob + lt * 0.004) * 14
        const y = s.cy + e.vy * 350 * drag - e.rise * lt
        const a = (1 - lt / e.life) * fade * (0.6 + 0.4 * Math.sin(lt * 0.03 + e.wob))
        drawGlow(ctx, e.color, x, y, e.size * 4, a)
      }
      ctx.globalCompositeOperation = 'source-over'
    }
  }
}

/** 70 · Diamante: um feixe branco bate no diamante e se abre num leque de arco-íris. */
const prism: Builder = (s, r) => {
  const n = s.budget
  const spectrum = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#818cf8', '#c084fc']
  const len = Math.hypot(s.w, s.h)
  const glints = Array.from({ length: n }, () => ({
    a: r() * Math.PI * 2,
    d: 80 + r() * len * 0.5,
    size: 4 + r() * 9,
    color: r() < 0.5 ? '#ffffff' : s.color
  }))
  const gem = 34 + 16 * s.power
  const beamAngle = (i: number, t: number): number =>
    -0.55 + (i / (spectrum.length - 1)) * 1.1 + Math.PI * 0.12 + prog(t, 1200, 3000) * Math.PI * 1.1
  return {
    particles: n,
    draw(ctx, t) {
      const fade = tailFade(t, s.durationMs)
      // Feixe de entrada (do canto de cima à esquerda).
      const inP = easeOut(prog(t, 150, 650))
      const sx = s.cx - len * 0.5
      const sy = s.cy - len * 0.32
      if (inP > 0) {
        ctx.globalCompositeOperation = 'lighter'
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(sx + (s.cx - sx) * inP, sy + (s.cy - sy) * inP)
        ctx.lineCap = 'round'
        for (const [lw, a] of [
          [18, 0.12],
          [7, 0.4],
          [2.5, 1]
        ] as const) {
          ctx.lineWidth = lw
          ctx.strokeStyle = hexA('#ffffff', a * fade)
          ctx.stroke()
        }
      }
      // Leque de cores saindo do diamante e girando pela tela.
      const out = easeOut(prog(t, 600, 1200))
      if (out > 0) {
        spectrum.forEach((color, i) => {
          const a = beamAngle(i, t)
          const spread = 0.05 + 0.03 * s.power
          const l = len * out
          ctx.beginPath()
          ctx.moveTo(s.cx, s.cy)
          ctx.lineTo(s.cx + Math.cos(a - spread) * l, s.cy + Math.sin(a - spread) * l)
          ctx.lineTo(s.cx + Math.cos(a + spread) * l, s.cy + Math.sin(a + spread) * l)
          ctx.closePath()
          const grad = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, l)
          grad.addColorStop(0, hexA(color, 0.75 * fade))
          grad.addColorStop(1, hexA(color, 0))
          ctx.fillStyle = grad
          ctx.fill()
        })
      }
      ctx.globalCompositeOperation = 'source-over'
      // O diamante.
      const pop = easeOutBack(prog(t, 0, 450))
      if (pop > 0) {
        ctx.save()
        ctx.translate(s.cx, s.cy)
        ctx.scale(pop, pop)
        ctx.rotate(Math.sin(t * 0.002) * 0.08)
        ctx.globalAlpha = fade
        const g = gem
        ctx.beginPath()
        ctx.moveTo(-g, -g * 0.35)
        ctx.lineTo(-g * 0.5, -g * 0.8)
        ctx.lineTo(g * 0.5, -g * 0.8)
        ctx.lineTo(g, -g * 0.35)
        ctx.lineTo(0, g)
        ctx.closePath()
        const grad = ctx.createLinearGradient(-g, -g, g, g)
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.5, s.color)
        grad.addColorStop(1, s.accent)
        ctx.fillStyle = grad
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(-g, -g * 0.35)
        ctx.lineTo(g, -g * 0.35)
        ctx.moveTo(-g * 0.5, -g * 0.8)
        ctx.lineTo(-g * 0.25, -g * 0.35)
        ctx.lineTo(0, g)
        ctx.lineTo(g * 0.25, -g * 0.35)
        ctx.lineTo(g * 0.5, -g * 0.8)
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(255,255,255,.7)'
        ctx.stroke()
        ctx.restore()
        drawGlow(ctx, '#ffffff', s.cx, s.cy, gem * 3, 0.5 * fade * (0.7 + 0.3 * Math.sin(t * 0.01)))
      }
      // Brilhos que acendem quando um feixe passa por eles.
      if (out > 0) {
        for (const gl of glints) {
          let near = 0
          for (let i = 0; i < spectrum.length; i += 3) {
            const diff = Math.abs(
              ((gl.a - beamAngle(i, t) + Math.PI * 3) % (Math.PI * 2)) - Math.PI
            )
            near = Math.max(near, 1 - Math.min(1, diff / 0.12))
          }
          if (gl.d > len * out) continue
          sparkle(
            ctx,
            s.cx + Math.cos(gl.a) * gl.d,
            s.cy + Math.sin(gl.a) * gl.d,
            gl.size * (0.5 + near),
            gl.color,
            (0.15 + near) * fade,
            t * 0.002
          )
        }
      }
    }
  }
}

/** 80 · Obsidiana: buraco negro suga tudo em espiral, colapsa e explode. */
const blackhole: Builder = (s, r) => {
  const n = s.budget
  const collapse = 1900
  const far = Math.hypot(s.w, s.h) * 0.55
  const motes = Array.from({ length: n }, (_, i) => ({
    r0: 120 + r() * far,
    a0: r() * Math.PI * 2,
    delay: r() * 500,
    vOut: 0.4 + r() * 0.9,
    aOut: r() * Math.PI * 2,
    size: 1.5 + r() * 2.5,
    color: i % 4 === 0 ? '#ffffff' : s.colors[i % s.colors.length]
  }))
  const posIn = (m: (typeof motes)[number], t: number): [number, number] => {
    const u = prog(t, m.delay, collapse)
    const rad = m.r0 * (1 - u) ** 1.2
    const a = m.a0 + 7 * u * u
    return [s.cx + Math.cos(a) * rad, s.cy + Math.sin(a) * rad * 0.8]
  }
  return {
    particles: n,
    draw(ctx, t) {
      const fade = tailFade(t, s.durationMs)
      // Tudo escurece em volta do centro.
      const dark = window4(t, 0, 900, collapse + 50, collapse + 500) * 0.7
      if (dark > 0) {
        const grad = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, far)
        grad.addColorStop(0, `rgba(0,0,0,${dark})`)
        grad.addColorStop(0.35, `rgba(5,3,15,${dark * 0.7})`)
        grad.addColorStop(1, `rgba(5,3,15,${dark * 0.25})`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, s.w, s.h)
      }
      // Poeira em espiral (antes do disco: some atrás do horizonte).
      if (t < collapse) {
        for (const m of motes) {
          if (t < m.delay) continue
          const [x, y] = posIn(m, t)
          const [px, py] = posIn(m, t - 50)
          ctx.beginPath()
          ctx.moveTo(px, py)
          ctx.lineTo(x, y)
          ctx.lineWidth = m.size
          ctx.strokeStyle = hexA(m.color, 0.9 * prog(t, m.delay, m.delay + 300))
          ctx.stroke()
        }
      }
      const hole = t < collapse ? 14 + 44 * easeIn(prog(t, 0, collapse * 0.8)) : 0
      const shrink = 1 - prog(t, collapse - 250, collapse)
      // Disco de acreção girando.
      if (t < collapse) {
        ctx.save()
        ctx.translate(s.cx, s.cy)
        ctx.scale(1, 0.35)
        ctx.rotate(t * 0.004)
        ctx.globalCompositeOperation = 'lighter'
        for (let k = 0; k < 3; k++) {
          ctx.beginPath()
          ctx.arc(0, 0, (hole * 1.6 + k * 16) * shrink, k, k + Math.PI * 1.4)
          ctx.lineWidth = 6 - k * 1.5
          ctx.strokeStyle = hexA(k === 1 ? '#ffffff' : s.color, 0.7 * prog(t, 0, 500))
          ctx.stroke()
        }
        ctx.restore()
        ctx.globalCompositeOperation = 'source-over'
        ctx.beginPath()
        ctx.arc(s.cx, s.cy, hole * shrink, 0, Math.PI * 2)
        ctx.fillStyle = '#000'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = hexA(s.color, 0.8)
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'lighter'
      // Clarão do colapso e onda da explosão.
      drawGlow(
        ctx,
        '#ffffff',
        s.cx,
        s.cy,
        300 + 200 * s.power,
        window4(t, collapse - 40, collapse + 40, collapse + 60, collapse + 700)
      )
      const boom = prog(t, collapse, collapse + 1300)
      if (boom > 0 && boom < 1) {
        ctx.beginPath()
        ctx.arc(s.cx, s.cy, easeOut(boom) * far * 1.4, 0, Math.PI * 2)
        ctx.lineWidth = 16 * (1 - boom) + 1
        ctx.strokeStyle = hexA(s.color, (1 - boom) * 0.9)
        ctx.stroke()
      }
      for (const m of motes) {
        if (t < m.delay) continue
        if (t < collapse) {
          continue // já desenhada antes do disco
        } else {
          const lt = t - collapse
          const d = m.vOut * 600 * (1 - Math.exp(-lt / 500))
          const x = s.cx + Math.cos(m.aOut) * d
          const y = s.cy + Math.sin(m.aOut) * d
          drawGlow(ctx, m.color, x, y, m.size * 5, fade * (1 - prog(lt, 900, 2000)))
        }
      }
      ctx.globalCompositeOperation = 'source-over'
    }
  }
}

/** 90 · Celestial: o céu escurece e estrelas desenham o número, ligadas por linhas. */
const constellation: Builder = (s, r) => {
  const shootingN = 2
  const bgN = Math.floor(s.budget * 0.3)
  const starN = s.budget - bgN - shootingN
  // Contorno denso em ordem (segue o traço) e depois uma estrela a cada tanto.
  const contour = pathOrder(textPoints(String(s.level), s.fontPx, Infinity, s.cx, s.cy, 'outline'))
  const stride = Math.max(1, contour.length / Math.max(1, starN))
  const stars = Array.from(
    { length: Math.min(starN, contour.length) },
    (_, i) => contour[Math.floor(i * stride)]
  )
  const gap = Math.max(s.fontPx * 0.12, (s.fontPx / 40) * stride * 2.2)
  const bg = Array.from({ length: bgN }, () => ({
    x: r() * s.w,
    y: r() * s.h,
    size: 1 + r() * 2,
    tw: r() * Math.PI * 2
  }))
  const shooting = Array.from({ length: shootingN }, (_, i) => ({
    x0: s.w * (0.1 + r() * 0.3),
    y0: s.h * (0.08 + r() * 0.15),
    t0: 2000 + i * 500
  }))
  const drawStart = 350
  const drawSpan = 1700
  const at = (i: number): number => drawStart + (i / Math.max(1, stars.length)) * drawSpan
  return {
    particles: stars.length + bg.length + shooting.length,
    draw(ctx, t) {
      const fade = tailFade(t, s.durationMs)
      const night = window4(t, 0, 500, s.durationMs * 0.75, s.durationMs) * 0.55
      if (night > 0) {
        const grad = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, Math.max(s.w, s.h) * 0.8)
        grad.addColorStop(0, `rgba(20,14,48,${night})`)
        grad.addColorStop(1, `rgba(6,4,20,${night})`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, s.w, s.h)
      }
      for (const b of bg) {
        const a = (0.4 + 0.6 * Math.abs(Math.sin(b.tw + t * 0.004))) * night * 1.6
        ctx.fillStyle = hexA('#ffffff', a)
        ctx.fillRect(b.x, b.y, b.size, b.size)
      }
      // Linhas ligando estrela com estrela (só as vizinhas, nada de pular dígito).
      ctx.lineWidth = 1.5
      for (let i = 1; i < stars.length; i++) {
        const a = stars[i - 1]
        const b = stars[i]
        if (Math.hypot(b.x - a.x, b.y - a.y) > gap) continue
        const p = prog(t, at(i - 1), at(i))
        if (p <= 0) continue
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p)
        ctx.strokeStyle = hexA(s.color, 0.55 * fade)
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'lighter'
      stars.forEach((st, i) => {
        const p = prog(t, at(i), at(i) + 250)
        if (p <= 0) return
        const pulse = 0.75 + 0.25 * Math.sin(t * 0.006 + i)
        const lift = prog(t, s.durationMs * 0.78, s.durationMs) * 30
        drawGlow(
          ctx,
          i % 3 ? s.color : s.accent,
          st.x,
          st.y - lift,
          9 * easeOutBack(p) * pulse,
          fade
        )
        sparkle(ctx, st.x, st.y - lift, 5 * p * pulse, '#ffffff', fade)
      })
      for (const sh of shooting) {
        const p = prog(t, sh.t0, sh.t0 + 700)
        if (p <= 0 || p >= 1) continue
        const x = sh.x0 + p * s.w * 0.5
        const y = sh.y0 + p * s.h * 0.25
        const grad = ctx.createLinearGradient(x - 120, y - 60, x, y)
        grad.addColorStop(0, hexA('#ffffff', 0))
        grad.addColorStop(1, hexA('#ffffff', (1 - p) * 0.95))
        ctx.beginPath()
        ctx.moveTo(x - 120, y - 60)
        ctx.lineTo(x, y)
        ctx.lineWidth = 2
        ctx.strokeStyle = grad
        ctx.stroke()
        drawGlow(ctx, s.color, x, y, 14, 1 - p)
      }
      ctx.globalCompositeOperation = 'source-over'
    }
  }
}

/** 100 · Lendário: varrida de arco-íris, aurora, fogos de artifício e varrida final. */
const legendary: Builder = (s, r) => {
  const rockets = 5
  const per = Math.max(1, Math.floor((s.budget - rockets) / rockets))
  const shows = Array.from({ length: rockets }, (_, i) => ({
    t0: 1000 + i * 480,
    x0: s.w * (0.2 + r() * 0.6),
    tx: s.w * (0.12 + ((i * 0.37 + r() * 0.2) % 1) * 0.76),
    ty: s.h * (0.12 + r() * 0.25),
    color: RAINBOW[i % RAINBOW.length],
    sparks: Array.from({ length: per }, (_, k) => ({
      a: (k / per) * Math.PI * 2 + r() * 0.2,
      v: 0.18 + r() * 0.12 + s.power * 0.05,
      color: k % 3 === 0 ? '#ffffff' : RAINBOW[(i + k) % RAINBOW.length]
    }))
  }))
  const ribbon = (ctx: CanvasRenderingContext2D, t: number, k: number, alpha: number): void => {
    const base = s.h * (0.18 + k * 0.1)
    const amp = s.h * 0.06
    const height = s.h * (0.22 + k * 0.05)
    const y = (x: number): number =>
      base +
      Math.sin(x * 0.006 + t * 0.0012 * (k + 1) + k) * amp +
      Math.sin(x * 0.013 - t * 0.002) * amp * 0.4
    ctx.beginPath()
    ctx.moveTo(0, y(0))
    for (let x = 0; x <= s.w; x += 24) ctx.lineTo(x, y(x))
    for (let x = s.w; x >= 0; x -= 24) ctx.lineTo(x, y(x) + height)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, s.w, 0)
    RAINBOW.forEach((c, i) => grad.addColorStop(i / (RAINBOW.length - 1), hexA(c, alpha)))
    ctx.fillStyle = grad
    ctx.fill()
  }
  const sweep = (ctx: CanvasRenderingContext2D, p: number, rtl: boolean, alpha: number): void => {
    if (p <= 0 || p >= 1) return
    const bw = s.w * 0.45
    const x = rtl ? s.w + bw - p * (s.w + bw * 2) : -bw + p * (s.w + bw * 2)
    const grad = ctx.createLinearGradient(x - bw, 0, x + bw, 0)
    grad.addColorStop(0, hexA(RAINBOW[0], 0))
    RAINBOW.forEach((c, i) => grad.addColorStop(0.2 + (i / RAINBOW.length) * 0.6, hexA(c, alpha)))
    grad.addColorStop(1, hexA(RAINBOW[4], 0))
    ctx.save()
    ctx.transform(1, 0, -0.35, 1, s.h * 0.17, 0)
    ctx.fillStyle = grad
    ctx.fillRect(x - bw, 0, bw * 2, s.h)
    ctx.restore()
  }
  return {
    particles: rockets + rockets * per,
    draw(ctx, t) {
      const fade = tailFade(t, s.durationMs)
      ctx.globalCompositeOperation = 'lighter'
      sweep(ctx, easeInOut(prog(t, 0, 900)), false, 0.35)
      const aurora = window4(t, 300, 1200, 3400, 4300) * 0.13
      if (aurora > 0) for (let k = 0; k < 3; k++) ribbon(ctx, t, k, aurora)
      drawGlow(
        ctx,
        '#ffffff',
        s.cx,
        s.cy,
        280 + 120 * s.power,
        window4(t, 350, 650, 700, 1500) * 0.6
      )
      for (const f of shows) {
        const climb = prog(t, f.t0, f.t0 + 450)
        if (climb <= 0) continue
        if (climb < 1) {
          const e = easeOut(climb)
          const x = f.x0 + (f.tx - f.x0) * e
          const y = s.h + 10 + (f.ty - s.h - 10) * e
          drawGlow(ctx, f.color, x, y, 10, 1)
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x - (f.tx - f.x0) * 0.05, y + 40)
          ctx.lineWidth = 2
          ctx.strokeStyle = hexA(f.color, 0.6)
          ctx.stroke()
          continue
        }
        const lt = t - f.t0 - 450
        if (lt > 1600) continue
        drawGlow(ctx, f.color, f.tx, f.ty, 90, window4(lt, 0, 40, 60, 400))
        const a = (1 - lt / 1600) * fade
        for (const sp of f.sparks) {
          const d = sp.v * 1000 * (1 - Math.exp(-lt / 450))
          const x = f.tx + Math.cos(sp.a) * d
          const y = f.ty + Math.sin(sp.a) * d + 0.00004 * lt * lt
          const flicker = lt > 900 ? 0.5 + 0.5 * Math.sin(lt * 0.05 + sp.a * 10) : 1
          drawGlow(ctx, sp.color, x, y, 6, a * flicker)
        }
      }
      // Varrida final de luz, da direita para a esquerda.
      sweep(ctx, easeInOut(prog(t, 3300, 4300)), true, 0.28)
      ctx.globalCompositeOperation = 'source-over'
    }
  }
}

const BUILDERS: Record<MilestoneKind, Builder> = {
  coins,
  shockwave,
  vines,
  ripple,
  crystals,
  fire,
  prism,
  blackhole,
  constellation,
  legendary
}

/** Instante (ms) do "impacto" de cada cena, quando a faixa/overlay treme. */
export const IMPACT_MS: Record<MilestoneKind, number> = {
  coins: 0,
  shockwave: 100,
  vines: 1200,
  ripple: 460,
  crystals: 1400,
  fire: 60,
  prism: 600,
  blackhole: 1900,
  constellation: 2000,
  legendary: 1450
}

/** Cenas que desenham o próprio número (o título em DOM só deixa o espaço). */
export const DRAWS_NUMBER: ReadonlySet<MilestoneKind> = new Set(['crystals', 'constellation'])

export function buildScene(kind: MilestoneKind, input: SceneInput): Scene {
  const scene = BUILDERS[kind](input, rng(input.level * 7919 + 17))
  return { draw: scene.draw, particles: Math.min(scene.particles, input.budget) }
}
