/**
 * Faixas de nível: a cada 10 níveis muda a cor (e a animação de subir fica
 * mais intensa). Do 100 em diante é "Lendário", com gradiente animado.
 */
export interface LevelTier {
  name: string
  /** Cor principal (badge, halo, faíscas). */
  color: string
  /** Segunda cor do gradiente do badge. */
  accent: string
}

const TIERS: LevelTier[] = [
  { name: 'Bronze', color: '#cd7f32', accent: '#8a4b16' },
  { name: 'Prata', color: '#c9d1dc', accent: '#7d8896' },
  { name: 'Ouro', color: '#f5c542', accent: '#b8860b' },
  { name: 'Esmeralda', color: '#34d399', accent: '#047857' },
  { name: 'Safira', color: '#60a5fa', accent: '#1d4ed8' },
  { name: 'Ametista', color: '#c084fc', accent: '#7e22ce' },
  { name: 'Rubi', color: '#f87171', accent: '#b91c1c' },
  { name: 'Diamante', color: '#67e8f9', accent: '#0e7490' },
  { name: 'Obsidiana', color: '#a5b4fc', accent: '#312e81' },
  { name: 'Celestial', color: '#fde68a', accent: '#db2777' }
]

export const LEGENDARY_TIER: LevelTier = { name: 'Lendário', color: '#ffffff', accent: '#f472b6' }

export function levelTier(level: number): LevelTier {
  if (level >= 100) return LEGENDARY_TIER
  return TIERS[Math.max(0, Math.floor(level / 10))] ?? TIERS[0]
}

/** Nível redondo (10, 20, 30…): ganha a animação de marco. */
export function isMilestone(level: number): boolean {
  return level > 1 && level % 10 === 0
}

/** Quantas faíscas a animação solta: cresce com a faixa, até 24. */
export function sparkCount(level: number): number {
  const tierIndex = Math.min(10, Math.floor(level / 10))
  return Math.min(24, 8 + tierIndex * 2 + (isMilestone(level) ? 6 : 0))
}

/** Percentual do nível atual já cumprido (0–100). */
export function levelPercent(intoLevel: number, forNext: number): number {
  if (forNext <= 0) return 0
  return Math.min(100, Math.max(0, Math.floor((intoLevel / forNext) * 100)))
}

/** "45 min", "3 h 20 min", "12 h". */
export function formatVoiceTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
}

/** Minutos de call que faltam para o próximo nível (10 XP por minuto). */
export const XP_PER_MINUTE = 10

export function minutesToNext(intoLevel: number, forNext: number): number {
  return Math.max(0, Math.ceil((forNext - intoLevel) / XP_PER_MINUTE))
}
