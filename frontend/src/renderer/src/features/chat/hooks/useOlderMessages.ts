import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useChatStore } from '../store/chatStore'
import type { Message } from '../api/messages'
import {
  anchorCandidates,
  measureOffset,
  restoreOlderAnchor,
  type OlderAnchor
} from '../lib/scrollAnchor'

/** Posição da mensagem dentro do scroller; null se ela não está desenhada nele. */
function offsetInside(scroller: HTMLElement, id: string): number | null {
  const node = document.getElementById(`msg-${id}`)
  return node && scroller.contains(node) ? measureOffset(scroller, node) : null
}

function withRoom(rooms: ReadonlySet<string>, room: string): ReadonlySet<string> {
  return new Set(rooms).add(room)
}

function withoutRoom(rooms: ReadonlySet<string>, room: string): ReadonlySet<string> {
  const next = new Set(rooms)
  next.delete(room)
  return next
}

/**
 * Páginas antigas da conversa (loadOlder e o pulo até uma mensagem antiga):
 * a antiga primeira mensagem (e sua posição no conteúdo) fica no mesmo lugar
 * da tela quando a página antiga entra em cima dela. As seguintes vão junto,
 * de reserva, caso ela seja apagada durante a espera.
 */
export function useOlderMessages({
  room,
  messages,
  scrollRef,
  onLeaveBottom
}: {
  room: string
  messages: Message[]
  scrollRef: React.RefObject<HTMLDivElement | null>
  /** Para de acompanhar o fim da lista enquanto a página antiga entra. */
  onLeaveBottom: () => void
}): {
  /** Esta sala está carregando páginas antigas. */
  loadingOlder: boolean
  loadOlder: () => Promise<void>
  /** Carrega até a mensagem aparecer; true = está na lista. */
  loadOlderUntil: (messageId: string) => Promise<boolean>
} {
  const loadOlderPage = useChatStore((s) => s.loadOlder)
  // Por sala: o ServerView reaproveita o ChatPane entre canais, e o
  // carregamento de um canal não pode travar (nem destravar) o do outro.
  const [loadingRooms, setLoadingRooms] = useState<ReadonlySet<string>>(new Set())
  const loadingOlder = loadingRooms.has(room)
  const anchorRef = useRef<OlderAnchor | null>(null)
  // Marca na hora (o estado só muda no próximo render): o scroll infinito
  // pode pedir de novo antes disso, e não carrega duas vezes em paralelo.
  const inFlight = useRef<Set<string>>(new Set())

  useEffect(() => {
    anchorRef.current = null
  }, [room])

  const firstId = messages[0]?.id
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const plan = restoreOlderAnchor({
      anchor: anchorRef.current,
      room,
      firstId,
      scrollTop: el.scrollTop,
      offsetOf: (id) => offsetInside(el, id)
    })
    anchorRef.current = plan.anchor
    if (plan.scrollTop !== null) el.scrollTop = plan.scrollTop
  }, [firstId, room, scrollRef])

  const captureAnchor = (startedRoom: string): OlderAnchor | null => {
    const el = scrollRef.current
    if (!el) return null
    const candidates = anchorCandidates(
      messages.map((m) => m.id),
      (id) => offsetInside(el, id)
    )
    return candidates.length > 0 ? { room: startedRoom, candidates } : null
  }

  const tracked = async <T>(startedRoom: string, task: () => Promise<T>): Promise<T> => {
    inFlight.current.add(startedRoom)
    setLoadingRooms((current) => withRoom(current, startedRoom))
    try {
      return await task()
    } finally {
      inFlight.current.delete(startedRoom)
      setLoadingRooms((current) => withoutRoom(current, startedRoom))
    }
  }

  const loadOlder = async (): Promise<void> => {
    if (inFlight.current.has(room)) return
    const startedRoom = room
    const anchor = captureAnchor(startedRoom)
    if (anchor) {
      anchorRef.current = anchor
      onLeaveBottom()
    }
    await tracked(startedRoom, () => loadOlderPage(startedRoom))
    // Nada novo (ou já aplicado no layout effect): esta âncora não vale para
    // a próxima mudança. Só a desta chamada — outra sala pode ter a sua.
    requestAnimationFrame(() => {
      if (anchor && anchorRef.current === anchor) anchorRef.current = null
    })
  }

  const loadOlderUntil = (messageId: string): Promise<boolean> => {
    const startedRoom = room
    const anchor = captureAnchor(startedRoom)
    if (anchor) anchorRef.current = anchor
    onLeaveBottom()
    return tracked(startedRoom, () =>
      useChatStore.getState().loadOlderUntil(startedRoom, messageId)
    )
  }

  return { loadingOlder, loadOlder, loadOlderUntil }
}
