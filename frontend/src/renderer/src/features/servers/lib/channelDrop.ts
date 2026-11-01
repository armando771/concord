// Arrastar canais para reordenar (dono/moderadores), cada um na sua seção.
// Funções sem React: o hook useChannelReorder guarda o estado e liga tudo.
import type { ChannelType } from '../api/channels'
import { channelDragType, dropInsertionIndex, insertionToTarget, isNoopDrop } from './channelOrder'

/** Onde aparece a linha de soltar: índice de inserção (0..n) na seção. */
export interface DropAt {
  type: ChannelType
  index: number
}

/** Canal sendo arrastado. */
export interface ChannelDrag {
  id: string
  type: ChannelType
}

/** Lado do bloco em que a linha de soltar aparece (ou nenhum). */
export type DropLineSide = 'before' | 'after' | null

/** Linha de soltar acima do bloco (ou, no último canal, abaixo dele). */
export function dropLineSide(
  dropAt: DropAt | null,
  type: ChannelType,
  index: number,
  last: boolean
): DropLineSide {
  if (dropAt?.type !== type) return null
  if (dropAt.index === index) return 'before'
  return last && dropAt.index === index + 1 ? 'after' : null
}

/** Mesma posição de soltar (não re-renderiza à toa durante o arrasto). */
export function sameDropAt(a: DropAt | null, b: DropAt | null): boolean {
  return a?.type === b?.type && a?.index === b?.index
}

/** Posição de soltar ao passar por cima; logo acima/abaixo do próprio canal não muda nada. */
export function nextDropAt(type: ChannelType, insertion: number, from: number): DropAt | null {
  return from >= 0 && isNoopDrop(from, insertion) ? null : { type, index: insertion }
}

/** De onde para onde o canal solto vai, ou null se não muda nada. */
export function dropMove(
  sectionIds: string[],
  id: string,
  insertion: number
): { from: number; to: number } | null {
  const from = sectionIds.indexOf(id)
  if (from < 0 || isNoopDrop(from, insertion)) return null
  return { from, to: insertionToTarget(from, insertion) }
}

/** Insere antes (metade de cima do bloco do canal) ou depois (de baixo). */
export function insertionAt(e: React.DragEvent<HTMLElement>, index: number): number {
  const rect = e.currentTarget.getBoundingClientRect()
  return dropInsertionIndex(index, e.clientY - rect.top, rect.height)
}

export interface ChannelDropContext {
  type: ChannelType
  index: number
  canManage: boolean
  /** Ids da seção, na ordem atual. */
  sectionIds: string[]
  drag: ChannelDrag | null
  setDrag: (drag: ChannelDrag | null) => void
  setDropAt: (update: (cur: DropAt | null) => DropAt | null) => void
  reorder: (type: ChannelType, from: number, to: number) => void
}

/** Bloco do canal como alvo de soltar outro canal da mesma seção. */
export function channelDropHandlers(ctx: ChannelDropContext): {
  onDragOver: (e: React.DragEvent<HTMLElement>) => void
  onDrop: (e: React.DragEvent<HTMLElement>) => void
} {
  const dragType = channelDragType(ctx.type)
  return {
    onDragOver: (e) => {
      if (!ctx.canManage || !e.dataTransfer.types.includes(dragType)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const from = ctx.sectionIds.indexOf(ctx.drag?.id ?? '')
      const next = nextDropAt(ctx.type, insertionAt(e, ctx.index), from)
      ctx.setDropAt((cur) => (sameDropAt(cur, next) ? cur : next))
    },
    onDrop: (e) => {
      const id = e.dataTransfer.getData(dragType)
      if (!ctx.canManage || !id) return
      e.preventDefault()
      const move = dropMove(ctx.sectionIds, id, insertionAt(e, ctx.index))
      ctx.setDrag(null)
      ctx.setDropAt(() => null)
      if (move) ctx.reorder(ctx.type, move.from, move.to)
    }
  }
}
