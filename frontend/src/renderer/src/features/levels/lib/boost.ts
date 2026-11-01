/**
 * Buff de XP de voz por pessoas na call. O backend manda só o percentual
 * (100 = sem buff); aqui ele vira o rank no estilo do ranking de estilo do
 * Devil May Cry (só letra e texto, nada de fonte/logo/arte do jogo) e as
 * flags do que a animação mostra: cada rank soma efeitos ao anterior.
 */
export type BoostStage = 1 | 2 | 3 | 4

export interface BoostRank {
  letter: 'A' | 'S' | 'SS' | 'SSS'
  text: string
  /** "x1.25" */
  label: string
  stage: BoostStage
  /** Cor principal da letra, brilho e faíscas. */
  color: string
  /** Contorno/sombra da letra. */
  accent: string
  /** Quanto o banner de ativação fica na tela. */
  durationMs: number
  /** Faíscas soltas pelo banner. */
  sparks: number
  /** Onda de choque (anel) atrás da letra. */
  ring: boolean
  /** Flash vermelho/dourado nas bordas da janela. */
  edgeFlash: boolean
  /** A janela inteira treme no slam. */
  quake: boolean
  /** Flash de tela cheia. */
  screenFlash: boolean
  /** Glitch periódico na letra. */
  glitch: boolean
  /** Aura pulsante no cabeçalho do canal de voz. */
  aura: boolean
}

const RANKS: Record<BoostStage, Omit<BoostRank, 'label'>> = {
  1: {
    letter: 'A',
    text: 'Alright!',
    stage: 1,
    color: '#ef4444',
    accent: '#7f1d1d',
    durationMs: 1200,
    sparks: 0,
    ring: false,
    edgeFlash: false,
    quake: false,
    screenFlash: false,
    glitch: false,
    aura: false
  },
  2: {
    letter: 'S',
    text: 'Sweet!',
    stage: 2,
    color: '#f87171',
    accent: '#b91c1c',
    durationMs: 1600,
    sparks: 0,
    ring: false,
    edgeFlash: true,
    quake: false,
    screenFlash: false,
    glitch: false,
    aura: false
  },
  3: {
    letter: 'SS',
    text: 'Showtime!',
    stage: 3,
    color: '#fb923c',
    accent: '#b45309',
    durationMs: 2000,
    sparks: 12,
    ring: true,
    edgeFlash: true,
    quake: false,
    screenFlash: false,
    glitch: false,
    aura: false
  },
  4: {
    letter: 'SSS',
    text: "Smokin' Sexy Style!",
    stage: 4,
    color: '#fde047',
    accent: '#b45309',
    durationMs: 2500,
    sparks: 22,
    ring: true,
    edgeFlash: true,
    quake: true,
    screenFlash: true,
    glitch: true,
    aura: true
  }
}

export function boostLabel(percent: number): string {
  const multiplier = percent / 100
  return `x${Number.isInteger(multiplier) ? multiplier.toFixed(1) : multiplier}`
}

/** Rank do buff, ou null quando não há buff (menos de 125%). */
export function boostRank(percent: number): BoostRank | null {
  const stage: BoostStage | 0 =
    percent >= 200 ? 4 : percent >= 175 ? 3 : percent >= 150 ? 2 : percent >= 125 ? 1 : 0
  if (stage === 0) return null
  return { ...RANKS[stage], label: boostLabel(percent) }
}

/** Call fictícia da prévia de dev (`__salinhaBoost`) quando você não está em call. */
export const PREVIEW_BOOST_CALL_ID = 'preview'

/**
 * O banner de ativação só toca para quem está na call do buff e não está
 * mutado/surdo (quem está pausado não ganha o buff, então não comemora).
 */
export function shouldPlayBoostBanner(
  paused: boolean,
  celebrationCallId: string,
  currentCallId: string | null
): boolean {
  if (paused) return false
  return celebrationCallId === PREVIEW_BOOST_CALL_ID || celebrationCallId === currentCallId
}
