import { useEffect } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../shared/theme/tokens'
import { useRoomMessages, type ChatTarget } from '../hooks/useRoomMessages'
import { useActiveRoomStore } from '../store/activeRoomStore'
import { useConversationsStore } from '../store/conversationsStore'
import { useUnreadStore } from '../store/unreadStore'
import { ChannelHeader } from './ChannelHeader'
import { Composer } from './Composer'
import { MessageList } from './MessageList'

export type ChatVariant = 'channel' | 'dm' | 'group'

interface ChatScreenProps {
  variant: ChatVariant
  /** Id do canal ou da conversa. */
  id: string
  /** Nome do canal, da pessoa ou do grupo. */
  title: string
  /** Servidor do canal (para descontar a não lida do servidor ao abrir). */
  serverId?: string
  onBack: () => void
}

const NO_PERMISSION = 'Você não tem permissão para enviar mensagens neste canal.'

const PRESENTATION: Record<ChatVariant, { prefix: string; label: (title: string) => string; target: ChatTarget['kind'] }> = {
  channel: { prefix: '#', label: (t) => `Mensagem para #${t}`, target: 'channel' },
  dm: { prefix: '@', label: (t) => `Mensagem para @${t}`, target: 'conversation' },
  group: { prefix: '', label: () => 'Mensagem para o grupo', target: 'conversation' }
}

/** Chat em tela cheia de um canal de texto, de uma DM ou de um grupo: cabeçalho, histórico e campo de envio. */
export function ChatScreen({ variant, id, title, serverId, onBack }: ChatScreenProps) {
  const { prefix, label, target } = PRESENTATION[variant]

  // Chat aberto: as mensagens dele não contam como não lidas, e abrir zera o que já havia.
  useEffect(() => {
    useActiveRoomStore.getState().setActive({ kind: target, id })
    if (target === 'channel') useUnreadStore.getState().clearChannel(id, serverId)
    else useConversationsStore.getState().markRead(id)
    return () => useActiveRoomStore.getState().setActive(null)
  }, [target, id, serverId])

  const { messages, status, hasMore, loadMore, send, retry } = useRoomMessages({ kind: target, id })
  // O layout do app tem paddingTop (área segura): o KeyboardAvoidingView mede a posição relativa ao pai
  // e não a conta, então sem este deslocamento o campo de envio ficava atrás do teclado.
  const { top } = useSafeAreaInsets()
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={top}
    >
      <ChannelHeader name={title} prefix={prefix} onBack={onBack} />
      <MessageList messages={messages} status={status} hasMore={hasMore} onLoadMore={() => void loadMore()} onRetry={() => void retry()} />
      <Composer label={label(title)} onSend={send} forbiddenNotice={variant === 'channel' ? NO_PERMISSION : undefined} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary }
})
