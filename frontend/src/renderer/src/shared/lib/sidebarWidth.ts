// Largura das barras laterais redimensionáveis (canais à esquerda, membros à
// direita). Puro, sem React: limites, arrasto, teclado e o encaixe na janela.

export type SidebarId = 'channels' | 'members'

/** Lado da janela em que a barra fica; a alça é a borda de dentro. */
export type PanelSide = 'left' | 'right'

export interface WidthBounds {
  min: number
  max: number
}

export interface SidebarSpec extends WidthBounds {
  id: SidebarId
  side: PanelSide
  defaultWidth: number
  storageKey: string
  /** Abaixo dessa largura de janela a barra fica escondida (CSS). */
  minViewport?: number
}

export const SIDEBARS: Record<SidebarId, SidebarSpec> = {
  // Canais do servidor e DMs/amigos dividem a mesma coluna (e a preferência).
  channels: {
    id: 'channels',
    side: 'left',
    min: 200,
    max: 420,
    defaultWidth: 240, // w-60
    storageKey: 'concord:sidebar-width:channels'
  },
  members: {
    id: 'members',
    side: 'right',
    min: 200,
    max: 400,
    defaultWidth: 256, // w-64
    storageKey: 'concord:sidebar-width:members',
    minViewport: 1024 // lg:flex
  }
}

/** Quem encolhe primeiro quando a janela aperta. */
const SHRINK_ORDER: SidebarId[] = ['members', 'channels']

/** Trilho de servidores (w-18), sempre visível. */
export const SERVER_RAIL_WIDTH = 72
/** O conteúdo do meio (chat/voz) não fica mais estreito que isso. */
export const MAIN_MIN_WIDTH = 360
/** Passo das setas do teclado na alça. */
export const KEYBOARD_STEP = 16

export function clampWidth(width: number, bounds: WidthBounds): number {
  if (!Number.isFinite(width)) return bounds.min
  return Math.round(Math.min(bounds.max, Math.max(bounds.min, width)))
}

/** Largura depois de arrastar `dx` px (positivo = para a direita). */
export function dragWidth(start: number, dx: number, side: PanelSide, bounds: WidthBounds): number {
  return clampWidth(side === 'left' ? start + dx : start - dx, bounds)
}

/**
 * Teclado na alça: as setas movem a borda (na barra da direita, ← alarga),
 * Home/End vão ao mínimo/máximo. Outra tecla: null.
 */
export function keyStepWidth(
  width: number,
  key: string,
  side: PanelSide,
  bounds: WidthBounds,
  step = KEYBOARD_STEP
): number | null {
  const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft'
  const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight'
  if (key === grow) return clampWidth(width + step, bounds)
  if (key === shrink) return clampWidth(width - step, bounds)
  if (key === 'Home') return bounds.min
  if (key === 'End') return bounds.max
  return null
}

/** Largura salva (string do localStorage) ou o padrão, se não houver/for lixo. */
export function parseStoredWidth(raw: string | null, spec: SidebarSpec): number {
  if (raw === null || raw.trim() === '') return spec.defaultWidth
  const n = Number(raw)
  return Number.isFinite(n) ? clampWidth(n, spec) : spec.defaultWidth
}

export interface SidebarLayoutInput {
  viewport: number
  /** Preferência salva de cada barra (não muda quando a janela encolhe). */
  preferred: Record<SidebarId, number>
  /** Barras na tela agora (a de membros só existe na página do servidor). */
  mounted: Record<SidebarId, boolean>
}

const isVisible = (id: SidebarId, input: SidebarLayoutInput): boolean =>
  input.mounted[id] && input.viewport >= (SIDEBARS[id].minViewport ?? 0)

/**
 * Larguras de fato: a preferência, encolhida (membros primeiro, depois canais,
 * cada uma até o mínimo) quando não sobram MAIN_MIN_WIDTH px para o conteúdo.
 */
export function layoutSidebarWidths(input: SidebarLayoutInput): Record<SidebarId, number> {
  const widths = {
    channels: clampWidth(input.preferred.channels, SIDEBARS.channels),
    members: clampWidth(input.preferred.members, SIDEBARS.members)
  }
  const visible = SHRINK_ORDER.filter((id) => isVisible(id, input))
  const used = visible.reduce((sum, id) => sum + widths[id], 0)
  let overflow = SERVER_RAIL_WIDTH + MAIN_MIN_WIDTH + used - input.viewport
  for (const id of visible) {
    if (overflow <= 0) break
    const give = Math.min(overflow, widths[id] - SIDEBARS[id].min)
    widths[id] -= give
    overflow -= give
  }
  return widths
}

/** Até onde dá para arrastar agora sem espremer o conteúdo além do mínimo. */
export function dragBoundsFor(id: SidebarId, input: SidebarLayoutInput): WidthBounds {
  const spec = SIDEBARS[id]
  const widths = layoutSidebarWidths(input)
  const others = SHRINK_ORDER.filter((o) => o !== id && isVisible(o, input)).reduce(
    (sum, o) => sum + widths[o],
    0
  )
  const room = input.viewport - SERVER_RAIL_WIDTH - MAIN_MIN_WIDTH - others
  return { min: spec.min, max: Math.max(spec.min, Math.min(spec.max, room)) }
}
