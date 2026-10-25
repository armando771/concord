import type { Channel } from '../api/channels'

/** Tipo usado no arrastar e soltar para reordenar canais do servidor. */
export const CHANNEL_DRAG = 'application/x-concord-channel'

export type DropPlacement = 'before' | 'after'

/**
 * Reordena os canais dentro da mesma seção (`text` ou `voice`).
 * Retorna `null` se o movimento for inválido ou não alterar a ordem atual.
 */
export function reorderChannelList(
  channels: Channel[],
  draggedId: string,
  targetId: string,
  placement: DropPlacement
): { nextChannels: Channel[]; sectionIds: string[] } | null {
  if (!draggedId || !targetId || draggedId === targetId) return null

  const dragged = channels.find((c) => c.id === draggedId)
  const target = channels.find((c) => c.id === targetId)
  if (!dragged || !target) return null

  const sectionType = dragged.type ?? 'text'
  const targetType = target.type ?? 'text'
  if (sectionType !== targetType) return null

  const section = channels.filter((c) => (c.type ?? 'text') === sectionType)
  const oldIds = section.map((c) => c.id)

  const withoutDragged = section.filter((c) => c.id !== draggedId)
  const targetIndex = withoutDragged.findIndex((c) => c.id === targetId)
  if (targetIndex === -1) return null

  const insertIndex = placement === 'before' ? targetIndex : targetIndex + 1
  const reorderedSection = [
    ...withoutDragged.slice(0, insertIndex),
    dragged,
    ...withoutDragged.slice(insertIndex)
  ].map((ch, idx) => ({ ...ch, position: idx }))

  const sectionIds = reorderedSection.map((c) => c.id)
  if (sectionIds.every((id, i) => id === oldIds[i])) {
    return null
  }

  let sectionCursor = 0
  const nextChannels = channels.map((ch) => {
    if ((ch.type ?? 'text') === sectionType) {
      return reorderedSection[sectionCursor++]
    }
    return ch
  })

  return { nextChannels, sectionIds }
}
