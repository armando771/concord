import { drawGlow, easeIn, easeOut, prog, window4, type Scene } from '../../levels/lib/sceneKit'

/**
 * Camadas da animação de subida de nível do servidor, num <canvas> só:
 * aqui a base (energia sendo sugada para o ícone, o estouro, ondas de choque,
 * raios de luz girando), os fogos e a tempestade de raios. Tudo montado uma
 * vez; por quadro só desenha (nada de alocar).
 */
export interface ServerEnv {
  w: number
  h: number
  /** Centro do ícone do servidor. */
  cx: number
  cy: number
  /** Raio do ícone. */
  icon: number
  palette: string[]
  color: string
  durationMs: number
  /** Quantos anéis de choque saem no estouro. */
  rings: number
}

/** Quando o número "explode" e tudo estoura (ms). */
export const IMPACT_MS = 700

export type LayerBuilder = (env: ServerEnv, r: () => number, budget: number) => Scene

/** Some tudo no fim da cena. */
export const tail = (env: ServerEnv, t: number): number =>
  1 - prog(t, env.durationMs * 0.8, env.durationMs)

const pick = (palette: string[], i: number): string => palette[i % palette.length]

interface Mote {
  angle: number
  dist: number
  size: number
  color: string
  delay: number
}

function motes(env: ServerEnv, r: () => number, count: number, reach: number): Mote[] {
  return Array.from({ length: count }, (_, i) => ({
    angle: r() * Math.PI * 2,
    dist: reach * (0.45 + r() * 0.55),
    size: 3 + r() * 6,
    color: pick(env.palette, i),
    delay: r() * 260
  }))
}

/** Energia sugada para o ícone antes do estouro. */
function drawImplode(ctx: CanvasRenderingContext2D, env: ServerEnv, list: Mote[], t: number): void {
  if (t >= IMPACT_MS) return
  for (const m of list) {
    const p = easeIn(prog(t, m.delay, IMPACT_MS))
    const d = m.dist * (1 - p)
    drawGlow(
      ctx,
      m.color,
      env.cx + Math.cos(m.angle) * d,
      env.cy + Math.sin(m.angle) * d,
      m.size,
      p
    )
  }
}

/** Faíscas voando do ícone no estouro. */
function drawBurst(ctx: CanvasRenderingContext2D, env: ServerEnv, list: Mote[], t: number): void {
  const fade = tail(env, t)
  for (const m of list) {
    const p = prog(t, IMPACT_MS + m.delay * 0.3, IMPACT_MS + 1600 + m.delay * 2)
    if (p <= 0 || p >= 1) continue
    const d = env.icon + m.dist * easeOut(p)
    const x = env.cx + Math.cos(m.angle) * d
    drawGlow(ctx, m.color, x, env.cy + Math.sin(m.angle) * d + 60 * p * p, m.size, (1 - p) * fade)
  }
}

/** Ondas de choque saindo do ícone. */
function drawShockwaves(ctx: CanvasRenderingContext2D, env: ServerEnv, t: number): void {
  const max = Math.hypot(env.w, env.h) * 0.6
  for (let i = 0; i < env.rings; i++) {
    const p = prog(t, IMPACT_MS + i * 180, IMPACT_MS + 1100 + i * 180)
    if (p <= 0 || p >= 1) continue
    ctx.globalAlpha = 1 - p
    ctx.strokeStyle = pick(env.palette, i)
    ctx.lineWidth = 10 * (1 - p) + 1
    ctx.beginPath()
    ctx.arc(env.cx, env.cy, env.icon + max * easeOut(p), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

const RAYS = 14

/** Raios de luz girando atrás do ícone. */
function drawRays(ctx: CanvasRenderingContext2D, env: ServerEnv, t: number): void {
  const alpha = 0.16 * prog(t, IMPACT_MS - 200, IMPACT_MS + 300) * tail(env, t)
  if (alpha <= 0) return
  const len = Math.hypot(env.w, env.h)
  const spin = t * 0.00035
  ctx.globalAlpha = alpha
  ctx.fillStyle = env.color
  for (let i = 0; i < RAYS; i++) {
    const a = spin + (i * Math.PI * 2) / RAYS
    ctx.beginPath()
    ctx.moveTo(env.cx, env.cy)
    ctx.lineTo(env.cx + Math.cos(a - 0.07) * len, env.cy + Math.sin(a - 0.07) * len)
    ctx.lineTo(env.cx + Math.cos(a + 0.07) * len, env.cy + Math.sin(a + 0.07) * len)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** A base de toda subida: suga energia, estoura, ondas de choque, raios girando e clarão. */
export const coreLayer: LayerBuilder = (env, r, budget) => {
  const reach = Math.min(env.w, env.h) * 0.6
  const inCount = Math.floor(budget * 0.35)
  const implode = motes(env, r, inCount, reach)
  const burst = motes(env, r, budget - inCount, reach)
  return {
    particles: implode.length + burst.length,
    draw: (ctx, t) => {
      drawRays(ctx, env, t)
      drawImplode(ctx, env, implode, t)
      drawShockwaves(ctx, env, t)
      drawBurst(ctx, env, burst, t)
      const flash = window4(t, IMPACT_MS - 80, IMPACT_MS, IMPACT_MS + 60, IMPACT_MS + 600)
      drawGlow(ctx, '#ffffff', env.cx, env.cy, env.icon * 4, flash)
    }
  }
}

interface Rocket {
  x: number
  apex: number
  at: number
  color: string
  sparks: { vx: number; vy: number }[]
}

const ROCKET_RISE = 520
const SPARK_LIFE = 1300
const GRAVITY = 0.00018

/** Foguetes subindo e estourando em volta (5+). */
export const fireworksLayer: LayerBuilder = (env, r, budget) => {
  const count = Math.max(2, Math.min(8, Math.floor(budget / 18)))
  const per = Math.max(4, Math.floor(budget / count) - 1)
  const span = env.durationMs * 0.55
  const rockets: Rocket[] = Array.from({ length: count }, (_, i) => ({
    x: env.w * (0.12 + r() * 0.76),
    apex: env.h * (0.12 + r() * 0.3),
    at: IMPACT_MS - 200 + (i * span) / count,
    color: pick(env.palette, i),
    sparks: Array.from({ length: per }, (_, k) => {
      const a = (k / per) * Math.PI * 2 + r() * 0.2
      const speed = 0.12 + r() * 0.1
      return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed }
    })
  }))
  return {
    particles: count * (per + 1),
    draw: (ctx, t) => {
      const fade = tail(env, t)
      for (const rocket of rockets) drawRocket(ctx, env, rocket, t, fade)
    }
  }
}

function drawRocket(
  ctx: CanvasRenderingContext2D,
  env: ServerEnv,
  rocket: Rocket,
  t: number,
  fade: number
): void {
  const dt = t - rocket.at
  if (dt < 0 || dt > ROCKET_RISE + SPARK_LIFE) return
  if (dt < ROCKET_RISE) {
    const y = env.h - (env.h - rocket.apex) * easeOut(dt / ROCKET_RISE)
    drawGlow(ctx, rocket.color, rocket.x, y, 6, fade)
    return
  }
  const s = dt - ROCKET_RISE
  const life = 1 - s / SPARK_LIFE
  drawGlow(ctx, '#ffffff', rocket.x, rocket.apex, 40, life * life * fade)
  for (const spark of rocket.sparks) {
    const x = rocket.x + spark.vx * s
    const y = rocket.apex + spark.vy * s + GRAVITY * s * s
    drawGlow(ctx, rocket.color, x, y, 5, life * fade)
  }
}

interface Bolt {
  /** Dois desenhos do mesmo raio (alterna para "tremer"). */
  paths: Float32Array[]
  at: number
  color: string
}

const BOLT_MS = 260
const BOLT_SEGMENTS = 11

function boltPath(env: ServerEnv, r: () => number, from: number, to: number): Float32Array {
  const angle = from
  const sx = env.cx + Math.cos(angle) * Math.hypot(env.w, env.h) * 0.6
  const sy = env.cy + Math.sin(angle) * Math.hypot(env.w, env.h) * 0.6
  const ex = env.cx + Math.cos(to) * env.icon
  const ey = env.cy + Math.sin(to) * env.icon
  const path = new Float32Array((BOLT_SEGMENTS + 1) * 2)
  for (let i = 0; i <= BOLT_SEGMENTS; i++) {
    const u = i / BOLT_SEGMENTS
    const jitter = i === 0 || i === BOLT_SEGMENTS ? 0 : (r() - 0.5) * 70
    path[i * 2] = sx + (ex - sx) * u + jitter
    path[i * 2 + 1] = sy + (ey - sy) * u + jitter * 0.6
  }
  return path
}

function strokePath(ctx: CanvasRenderingContext2D, path: Float32Array): void {
  ctx.beginPath()
  ctx.moveTo(path[0], path[1])
  for (let i = 2; i < path.length; i += 2) ctx.lineTo(path[i], path[i + 1])
  ctx.stroke()
}

function drawBolt(ctx: CanvasRenderingContext2D, env: ServerEnv, bolt: Bolt, t: number): void {
  const dt = t - bolt.at
  if (dt < 0 || dt > BOLT_MS) return
  const path = bolt.paths[Math.floor(dt / 60) % bolt.paths.length]
  const alpha = 1 - dt / BOLT_MS
  // Clarão rápido na tela inteira quando o raio cai.
  ctx.globalAlpha = 0.14 * alpha
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, env.w, env.h)
  ctx.globalAlpha = 0.35 * alpha
  ctx.strokeStyle = bolt.color
  ctx.lineWidth = 9
  strokePath(ctx, path)
  ctx.globalAlpha = alpha
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.2
  strokePath(ctx, path)
  ctx.globalAlpha = 1
}

/** Raios das bordas até o ícone (10+), com clarão. */
export const lightningLayer: LayerBuilder = (env, r, budget) => {
  const count = Math.max(3, Math.min(10, Math.floor(budget / 4)))
  const span = env.durationMs * 0.6
  const bolts: Bolt[] = Array.from({ length: count }, (_, i) => {
    const from = r() * Math.PI * 2
    const to = from + (r() - 0.5) * 0.6
    return {
      paths: [boltPath(env, r, from, to), boltPath(env, r, from, to)],
      at: IMPACT_MS - 150 + (i * span) / count + r() * 120,
      color: pick(env.palette, i)
    }
  })
  return {
    particles: count,
    draw: (ctx, t) => {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const bolt of bolts) drawBolt(ctx, env, bolt, t)
    }
  }
}
