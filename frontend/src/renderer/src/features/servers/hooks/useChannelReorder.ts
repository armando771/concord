import { useState } from 'react'
import type { Channel, ChannelType } from '../api/channels'
import { useServerStore } from '../store/serverStore'
import { useChannelSidebarStore } from '../store/channelSidebarStore'
import { channelDragType, moveItem } from '../lib/channelOrder'
import {
  channelDropHandlers,
  dropLineSide,
  type ChannelDrag,
  type DropAt,
  type DropLineSide
} from '../lib/channelDrop'
import { showToast } from '../../../shared/store/toastStore'

/** Muda a ordem na hora; se o servidor recusar, volta e avisa. */
export async function moveChannel(
  serverId: string,
  type: ChannelType,
  sectionIds: string[],
  from: number,
  to: number
): Promise<void> {
  try {
    await useServerStore.getState().reorderChannels(serverId, type, moveItem(sectionIds, from, to))
  } catch {
    showToast.error('Não foi possível mudar a ordem dos canais.')
  }
}

export interface ChannelReorder {
  /** Canal sendo arrastado (fica apagado). */
  draggingId: string | null
  /** Props da linha do canal que pode ser arrastada (nada para quem não pode). */
  dragSource: (
    ch: Channel,
    type: ChannelType
  ) => React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean }
  /** Bloco do canal como alvo de soltar outro canal da mesma seção. */
  dropTarget: (type: ChannelType, index: number) => ReturnType<typeof channelDropHandlers>
  lineSide: (type: ChannelType, index: number, last: boolean) => DropLineSide
  /** Saiu da seção arrastando: some a linha. */
  clearOnLeave: (e: React.DragEvent<HTMLElement>) => void
  /** Move pelo menu (alternativa ao arrastar). */
  move: (type: ChannelType, from: number, to: number) => void
}

/** Reordenar canais arrastando (dono/moderadores), cada um na sua seção. */
export function useChannelReorder(
  serverId: string,
  sections: Record<ChannelType, Channel[]>,
  canManage: boolean
): ChannelReorder {
  const [drag, setDrag] = useState<ChannelDrag | null>(null)
  const [dropAt, setDropAt] = useState<DropAt | null>(null)
  const closeMenu = useChannelSidebarStore((s) => s.closeMenu)
  const idsOf = (type: ChannelType): string[] => sections[type].map((c) => c.id)
  const move = (type: ChannelType, from: number, to: number): void => {
    void moveChannel(serverId, type, idsOf(type), from, to)
  }
  return {
    draggingId: drag?.id ?? null,
    dragSource: (ch, type) =>
      canManage
        ? {
            draggable: true,
            onDragStart: (e) => {
              e.dataTransfer.setData(channelDragType(type), ch.id)
              e.dataTransfer.effectAllowed = 'move'
              closeMenu()
              setDrag({ id: ch.id, type })
            },
            onDragEnd: () => {
              setDrag(null)
              setDropAt(null)
            }
          }
        : {},
    dropTarget: (type, index) =>
      channelDropHandlers({
        type,
        index,
        canManage,
        sectionIds: idsOf(type),
        drag,
        setDrag,
        setDropAt,
        reorder: move
      }),
    lineSide: (type, index, last) => dropLineSide(dropAt, type, index, last),
    clearOnLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null)
    },
    move
  }
}
