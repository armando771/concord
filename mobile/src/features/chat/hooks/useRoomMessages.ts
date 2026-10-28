import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/client'
import { onRealtimeReconnect, realtime } from '../../../shared/api/realtime'
import { onWsEvent, type WsEvent } from '../../../shared/api/ws'
import { listChannelMessages, MESSAGE_LIMIT, sendChannelMessage, type Message } from '../api/messages'
import { mergeMessages, oldestId, removeMessage } from '../lib/messageList'

export type LoadStatus = 'loading' | 'ready' | 'error'
export type SendOutcome = 'ok' | 'empty' | 'forbidden' | 'error'

/** Aplica um evento do WebSocket à lista deste canal (null = não é deste canal/evento). */
function applyEvent(current: Message[], event: WsEvent, channelId: string): Message[] | null {
  const payload = event.payload as { message?: Message; message_id?: string; channel_id?: string }
  if (event.type === 'message:create' || event.type === 'message:update') {
    return payload.message?.channel_id === channelId ? mergeMessages(current, [payload.message]) : null
  }
  if (event.type === 'message:delete' && payload.channel_id === channelId && payload.message_id) {
    return removeMessage(current, payload.message_id)
  }
  return null
}

/** O que o chat mostra: um canal de texto ou uma conversa (DM). */
export interface ChatTarget {
  kind: 'channel'
  id: string
}

/** Histórico, tempo real e envio do chat de um canal de texto. */
export function useRoomMessages(target: ChatTarget) {
  const channelId = target.id
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [hasMore, setHasMore] = useState(true)
  const channelRef = useRef(channelId)
  const loadingMore = useRef(false)
  channelRef.current = channelId

  /** Busca a página mais recente e junta; respostas de outro canal (já trocado) são descartadas. */
  const fetchLatest = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setStatus('loading')
      try {
        const page = await listChannelMessages(channelId)
        if (channelRef.current !== channelId) return
        setMessages((current) => mergeMessages(current, page))
        if (showLoading) setHasMore(page.length >= MESSAGE_LIMIT)
        setStatus('ready')
      } catch {
        if (channelRef.current === channelId && showLoading) setStatus('error')
      }
    },
    [channelId]
  )

  useEffect(() => {
    setMessages([])
    setHasMore(true)
    void fetchLatest(true)
  }, [fetchLatest])

  useEffect(() => {
    const room = `channel:${channelId}`
    realtime.subscribe(room)
    const offEvents = onWsEvent((event) => setMessages((current) => applyEvent(current, event, channelId) ?? current))
    const offReconnect = onRealtimeReconnect(() => void fetchLatest(false))
    return () => {
      realtime.unsubscribe(room)
      offEvents()
      offReconnect()
    }
  }, [channelId, fetchLatest])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore.current || status !== 'ready') return
    loadingMore.current = true
    try {
      const page = await listChannelMessages(channelId, oldestId(messages))
      if (channelRef.current !== channelId) return
      setMessages((current) => mergeMessages(current, page))
      setHasMore(page.length >= MESSAGE_LIMIT)
    } catch {
      // a próxima rolagem tenta de novo
    } finally {
      loadingMore.current = false
    }
  }, [channelId, hasMore, messages, status])

  const send = useCallback(
    async (text: string): Promise<SendOutcome> => {
      const content = text.trim()
      if (!content) return 'empty'
      try {
        const sent = await sendChannelMessage(channelId, content)
        setMessages((current) => mergeMessages(current, [sent]))
        return 'ok'
      } catch (err) {
        return err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error'
      }
    },
    [channelId]
  )

  const retry = useCallback(() => fetchLatest(true), [fetchLatest])

  return { messages, status, hasMore, loadMore, send, retry }
}
