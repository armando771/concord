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

/** Sons da subida de nível (lib/sounds.ts). */
export type LevelChime = 'levelChime' | 'levelChimeRich' | 'levelFanfare'

/**
 * O que a animação de subir de nível mostra. Os campos de avatar valem para
 * todo mundo (lista de membros, tile da chamada); os de janela só para quem
 * subiu, então o que os outros veem fica sempre menor que a sua festa.
 */
export interface LevelUpEffects {
  tier: LevelTier
  /** Degrau da escada: 0 = 1–19, 1 = 20–39, … 4 = 80–99, 5 = 100+. */
  stage: number

  // Avatar
  sparks: number
  /** Nível redondo (10, 20…). */
  shockwave: boolean
  /** Raios de luz girando atrás do avatar. */
  rays: boolean
  /** Partículas girando em volta do avatar. */
  orbit: number
  /** Tamanho do burst no avatar (os outros veem crescer com o nível). */
  burstScale: number
  /** O tile da pessoa na chamada brilha na cor da faixa. */
  tileGlow: boolean
  /** O número do selo rola pelos níveis até o novo. */
  rollNumber: boolean

  // Janela de quem subiu
  /** Borda da faixa girando na cor da faixa. */
  bannerBorder: boolean
  /** Confete saindo da faixa. */
  confetti: number
  /** Pulso de vinheta na janela inteira. */
  vignette: boolean
  /** Emblema grande da faixa atrás do banner. */
  emblem: boolean
  /** Celebração em tela cheia (aurora, estrelas, coroa, "LENDÁRIO"). */
  legendary: boolean
  /** Estrelas caindo na celebração lendária. */
  stars: number
  /** "Nova faixa: <nome>!" quando entra numa faixa nova. */
  tierReveal: string | null
  chime: LevelChime | null
  /** Quanto a celebração fica na tela (banner incluso). */
  durationMs: number
}

// Um valor por degrau (1–19, 20–39, 40–59, 60–79, 80–99, 100+). Somando
// faíscas + órbita + confete + estrelas, o topo fica em 60 partículas.
const DURATION_MS = [3200, 3600, 4000, 4400, 4800, 5200]
const ORBIT = [0, 0, 6, 6, 8, 10]
const CONFETTI = [0, 0, 0, 14, 16, 12]
const STARS = [0, 0, 0, 0, 0, 14]
const BURST_SCALE = [1, 1, 1.15, 1.35, 1.5, 1.7]
const CHIMES: (LevelChime | null)[] = [
  null,
  null,
  'levelChime',
  'levelChime',
  'levelChimeRich',
  'levelFanfare'
]

/**
 * Escada da animação de subir de nível: cada degrau de 20 níveis soma um
 * efeito ao anterior, até a celebração lendária do 100. `previous` é o nível
 * de antes (pode ter pulado vários) e decide se entrou numa faixa nova.
 */
export function levelUpEffects(level: number, previous = level - 1): LevelUpEffects {
  const stage = level >= 100 ? 5 : Math.max(0, Math.floor(level / 20))
  const tier = levelTier(level)
  return {
    tier,
    stage,
    sparks: sparkCount(level),
    shockwave: isMilestone(level),
    rays: stage >= 1,
    orbit: ORBIT[stage],
    burstScale: BURST_SCALE[stage],
    tileGlow: stage >= 3,
    rollNumber: stage >= 1,
    bannerBorder: stage >= 2,
    confetti: CONFETTI[stage],
    vignette: stage >= 4,
    emblem: stage >= 4,
    legendary: stage === 5,
    stars: STARS[stage],
    tierReveal: level > 1 && levelTier(previous) !== tier ? tier.name : null,
    chime: CHIMES[stage],
    durationMs: DURATION_MS[stage]
  }
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
