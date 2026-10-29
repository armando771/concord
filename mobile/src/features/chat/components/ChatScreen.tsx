import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../shared/theme/tokens'
import { useChannelMessages } from '../hooks/useChannelMessages'
import { ChannelHeader } from './ChannelHeader'
import { Composer } from './Composer'
import { MessageList } from './MessageList'

interface ChatScreenProps {
  channelId: string
  channelName: string
  onBack: () => void
}

/** Chat de um canal de texto em tela cheia: cabeçalho, histórico e campo de envio. */
export function ChatScreen({ channelId, channelName, onBack }: ChatScreenProps) {
  const { messages, status, hasMore, loadMore, send, retry } = useChannelMessages(channelId)
  // O layout do app tem paddingTop (área segura): o KeyboardAvoidingView mede a posição relativa ao pai
  // e não a conta, então sem este deslocamento o campo de envio ficava atrás do teclado.
  const { top } = useSafeAreaInsets()
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={top}
    >
      <ChannelHeader name={channelName} onBack={onBack} />
      <MessageList messages={messages} status={status} hasMore={hasMore} onLoadMore={() => void loadMore()} onRetry={() => void retry()} />
      <Composer channelName={channelName} onSend={send} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary }
})
