import { useRef, useState } from 'react'
import type { Message } from '../api/messages'
import {
  advanceRoomJump,
  countNewSince,
  JUMP_INITIAL,
  jumpOf,
  jumpScrollBehavior,
  showJump,
  type RoomJump
} from '../lib/jumpToPresent'

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

/**
 * Botão "voltar às mensagens recentes" da lista de mensagens: diz se ele
 * aparece, quantas mensagens novas chegaram desde que a pessoa saiu do fim e
 * rola de volta. Não rola a lista sozinho: quem gruda no fim é o ChatPane.
 *
 * O estado é por sala (o ServerView reaproveita o ChatPane entre canais): ao
 * trocar de sala o que sobrou da anterior é descartado.
 */
export function useJumpToPresent({
  room,
  messages,
  selfId
}: {
  room: string
  messages: Message[]
  selfId: string | undefined
}): {
  visible: boolean
  newCount: number
  /** Chamar a cada scroll da lista. */
  onScroll: (el: HTMLElement) => void
  /** Rola até a última mensagem. */
  jumpToPresent: (el: HTMLElement | null) => void
} {
  const [state, setState] = useState<RoomJump>({ room, jump: JUMP_INITIAL })
  const lastScrollTop = useRef(0)
  const jump = jumpOf(state, room)
  const latestCreatedAt = messages.at(-1)?.created_at ?? null

  const onScroll = (el: HTMLElement): void => {
    const prevTop = lastScrollTop.current
    lastScrollTop.current = el.scrollTop
    setState((prev) => advanceRoomJump(prev, room, el, prevTop, latestCreatedAt))
  }

  const jumpToPresent = (el: HTMLElement | null): void => {
    el?.scrollTo({
      top: el.scrollHeight,
      behavior: jumpScrollBehavior(prefersReducedMotion())
    })
  }

  const newCount = countNewSince(messages, jump.leftAt, selfId)
  return { visible: showJump(jump.far, newCount), newCount, onScroll, jumpToPresent }
}
