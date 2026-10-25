// Atividades: jogos web de terceiros abertos junto com a chamada (o jogo roda
// no site de quem o hospeda; a VPS só repassa qual atividade está aberta).
// Catálogo e validação de link puros, usados pelo renderer e pelo main.
// O backend tem a mesma lista de origens (backend/internal/call/activity.go).

export interface ActivityDefinition {
  id: string
  name: string
  /** Gênero curto, no selo do card. */
  category: string
  description: string
  /** Página inicial do jogo (quem entra sem link de sala). */
  homeUrl: string
  /** Origens aceitas no link da sala (esquema + host, sem barra no fim). */
  origins: string[]
  /** Exemplo do link da sala, no placeholder do campo. */
  linkExample: string
  /** Ícone do card (o renderer mapeia para o SVG). */
  icon: 'crosshair'
  /** Cor de destaque do card (ícone). */
  accent: string
  /** Partição de sessão da janela no desktop (cookies e login só dela). */
  partition: string
}

export const ACTIVITIES: readonly ActivityDefinition[] = [
  {
    id: 'krunker',
    name: 'Krunker.io',
    category: 'FPS',
    description: 'Tiro em primeira pessoa no navegador, rápido e sem instalar nada.',
    homeUrl: 'https://krunker.io/',
    origins: ['https://krunker.io'],
    linkExample: 'https://krunker.io/?game=XX:xxxxx',
    icon: 'crosshair',
    accent: '#f0b232',
    partition: 'persist:activity-krunker'
  }
]

/** Tamanho máximo do link da sala (o backend usa o mesmo limite). */
export const MAX_ACTIVITY_URL = 512

export function findActivity(id: string): ActivityDefinition | undefined {
  return ACTIVITIES.find((a) => a.id === id)
}

export type ActivityLinkResult = { ok: true; url: string } | { ok: false; error: string }

/**
 * Confere o link da sala colado por quem abre a atividade. Vazio é aceito
 * (quem entrar abre a página do jogo). Só esquema + host exatamente iguais a
 * uma origem do catálogo: sem usuário, porta, subdomínio ou outro esquema.
 */
export function validateActivityLink(activityId: string, raw: string): ActivityLinkResult {
  const activity = findActivity(activityId)
  if (!activity) return { ok: false, error: 'Atividade desconhecida.' }
  const link = raw.trim()
  if (link === '') return { ok: true, url: '' }
  const invalid: ActivityLinkResult = {
    ok: false,
    error: `Use um link ${activity.origins[0]}/…`
  }
  if (link.length > MAX_ACTIVITY_URL) return invalid
  // A autoridade crua (antes do URL normalizar porta, barras invertidas etc.).
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(link)
  if (!match) return invalid
  const origin = `${match[1].toLowerCase()}://${match[2].toLowerCase()}`
  if (!activity.origins.includes(origin)) return invalid
  try {
    new URL(link)
  } catch {
    return invalid
  }
  return { ok: true, url: link }
}

/** Link não vazio e dentro das origens da atividade (main confere antes de abrir). */
export function isAllowedActivityUrl(activityId: string, url: string): boolean {
  const result = validateActivityLink(activityId, url)
  return result.ok && result.url !== ''
}

/** O que abrir para entrar: o link da sala, ou a página do jogo sem link. */
export function activityLaunchUrl(activityId: string, link: string): string | null {
  const activity = findActivity(activityId)
  if (!activity) return null
  return isAllowedActivityUrl(activityId, link) ? link.trim() : activity.homeUrl
}
