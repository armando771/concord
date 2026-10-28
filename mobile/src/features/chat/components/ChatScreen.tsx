import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
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
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ChannelHeader name={channelName} onBack={onBack} />
      <MessageList messages={messages} status={status} hasMore={hasMore} onLoadMore={() => void loadMore()} onRetry={() => void retry()} />
      <Composer channelName={channelName} onSend={send} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary }
})
