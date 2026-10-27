// Partículas dos efeitos feitos só com CSS (partículas, brilhos, neve).

export interface Particle {
  /** Posição em % do cartão. */
  left: number
  top: number
  /** Tamanho em px. */
  size: number
  /** Segundos. */
  delay: number
  duration: number
}

const PARTICLE_COUNT: Record<string, number> = { particles: 14, sparkles: 10, snow: 18 }

/**
 * Posições fixas (sempre as mesmas para o mesmo efeito): o desenho não muda a
 * cada render e o CSS só anima transform/opacity.
 */
export function effectParticles(effect: string): Particle[] {
  const count = PARTICLE_COUNT[effect] ?? 0
  let seed = effect.length * 7919 + 17
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  return Array.from({ length: count }, (_, i) => {
    const r = [rand(), rand(), rand(), rand()]
    return {
      // Espalha por faixas para não amontoar.
      left: Math.round(((i + r[0]) / count) * 1000) / 10,
      top: Math.round(r[1] * 1000) / 10,
      size: effect === 'sparkles' ? 8 + Math.round(r[2] * 6) : 2 + Math.round(r[2] * 3),
      delay: Math.round(r[3] * (effect === 'snow' ? 8 : 4) * 10) / 10,
      duration: effect === 'snow' ? 7 + Math.round(r[2] * 50) / 10 : 3 + Math.round(r[0] * 30) / 10
    }
  })
}
