// Atividades: jogos web de terceiros abertos junto com a chamada (o jogo roda
// no site de quem o hospeda; a VPS só repassa qual atividade está aberta).
// Catálogo e validação de link puros, usados pelo renderer e pelo main.
// O backend tem a mesma lista de origens (backend/internal/call/activity.go).

/**
 * Como o jogo marca a sala na própria URL (o desktop lê da janela e
 * compartilha sozinho; o link colado também pode ser só o código):
 * - query: `/?param=CÓDIGO` (Krunker: `?game=REGIÃO:id`, a partida em que se está);
 * - hash: `/#CÓDIGO` (survev/Suroi: o time criado), com a região opcional.
 */
export type ActivityRoom =
  { kind: 'query'; param: string; code: RegExp } | { kind: 'hash'; code: RegExp; region?: RegExp }

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
  icon: 'crosshair' | 'royale'
  /** Onde a sala aparece na URL do jogo. */
  room: ActivityRoom
  /** Como criar a sala que vai para a chamada (dica no seletor). */
  roomHint: string
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
    room: { kind: 'query', param: 'game', code: /^[A-Z]{2,5}:[a-z0-9]{2,16}$/i },
    roomHint: 'Quando você entrar numa partida, ela vai para todos da chamada.',
    accent: '#f0b232',
    partition: 'persist:activity-krunker'
  },
  {
    id: 'survev',
    name: 'survev.io',
    category: 'Battle royale',
    description: 'O surviv.io de volta (código aberto): battle royale 2D de até 4 por time.',
    homeUrl: 'https://survev.io/',
    origins: ['https://survev.io'],
    linkExample: 'https://survev.io/#xxxx',
    icon: 'royale',
    room: { kind: 'hash', code: /^[A-Za-z0-9]{4,8}$/ },
    roomHint: 'Crie um time (Create Team) e o convite vai para todos da chamada.',
    accent: '#84cc16',
    partition: 'persist:activity-survev'
  },
  {
    id: 'suroi',
    name: 'Suroi',
    category: 'Battle royale',
    description: 'Battle royale 2D de código aberto, no estilo do surviv.io, com times.',
    homeUrl: 'https://suroi.io/',
    origins: ['https://suroi.io'],
    linkExample: 'https://suroi.io/#xxxx',
    icon: 'royale',
    room: { kind: 'hash', code: /^[A-Za-z0-9]{4,8}$/, region: /^[a-z0-9_-]{1,16}$/i },
    roomHint: 'Crie um time (Create Team) e o convite vai para todos da chamada.',
    accent: '#ff8a1f',
    partition: 'persist:activity-suroi'
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
  // Só o código da sala (no iframe o survev copia só ele): monta o link.
  if (!link.includes('://')) {
    const code = activity.room.kind === 'hash' ? link.replace(/^#/, '') : link
    return activity.room.code.test(code) ? { ok: true, url: roomUrl(activity, code) } : invalid
  }
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

function roomUrl(activity: ActivityDefinition, code: string, region?: string): string {
  const origin = activity.origins[0]
  if (activity.room.kind === 'query') return `${origin}/?${activity.room.param}=${code}`
  return `${origin}/${region ? `?region=${region}` : ''}#${code}`
}

/**
 * A sala em que a janela do jogo está agora (desktop: lida a cada navegação
 * da janela), já no formato canônico — só origem, `/` e os parâmetros da sala;
 * o resto da URL (tokens, rastreio) fica de fora. null = não é uma sala.
 */
export function activityRoomFromUrl(activityId: string, url: string): string | null {
  const activity = findActivity(activityId)
  if (!activity) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (!activity.origins.includes(parsed.origin) || parsed.pathname !== '/') return null
  const room = activity.room
  if (room.kind === 'query') {
    const code = parsed.searchParams.get(room.param) ?? ''
    return room.code.test(code) ? roomUrl(activity, code) : null
  }
  const code = parsed.hash.replace(/^#/, '')
  if (!room.code.test(code)) return null
  const region = parsed.searchParams.get('region') ?? ''
  return roomUrl(activity, code, room.region?.test(region) ? region : undefined)
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
