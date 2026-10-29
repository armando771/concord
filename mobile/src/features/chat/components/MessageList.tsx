import { FlatList, StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, spacing } from '../../../shared/theme/tokens'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import type { Message } from '../api/messages'
import type { LoadStatus } from '../hooks/useRoomMessages'
import { groupMessages } from '../lib/messageGroups'
import { MessageItem } from './MessageItem'

interface MessageListProps {
  /** Da mais nova para a mais antiga. */
  messages: Message[]
  status: LoadStatus
  hasMore: boolean
  onLoadMore: () => void
  onRetry: () => void
}

/** Histórico do canal: lista invertida (a mais nova embaixo), pagina ao rolar para cima. */
export function MessageList({ messages, status, hasMore, onLoadMore, onRetry }: MessageListProps) {
  // Os estados vazios ficam fora da FlatList: dentro de uma lista invertida eles saem de cabeça para baixo.
  if (status === 'loading' && messages.length === 0) return <Centered text="Carregando mensagens…" />
  if (status === 'error' && messages.length === 0) {
    return (
      <View style={styles.centered}>
        <Banner message="Não foi possível carregar as mensagens." />
        <Button title="Tentar de novo" onPress={onRetry} variant="secondary" />
      </View>
    )
  }
  if (messages.length === 0) return <Centered text="Ainda não há mensagens aqui." />

  return (
    <FlatList
      inverted
      data={groupMessages(messages)}
      keyExtractor={(item) => item.message.id}
      renderItem={({ item }) => <MessageItem item={item} />}
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      keyboardShouldPersistTaps="handled"
      style={styles.list}
    />
  )
}

function Centered({ text }: { text: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.text}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bgPrimary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.bgPrimary },
  text: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center' }
})
