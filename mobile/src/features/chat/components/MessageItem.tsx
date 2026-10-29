import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, spacing } from '../../../shared/theme/tokens'
import { Avatar } from '../../../shared/ui/Avatar'
import type { Message } from '../api/messages'
import { dayLabelText, timeText } from '../lib/dayLabel'
import type { GroupedMessage } from '../lib/messageGroups'

interface MessageItemProps {
  item: GroupedMessage
  timeZone?: string
}

/** Anexo, figurinha ou GIF sem texto: ainda não aparecem no app. */
const hasUnsupportedOnly = (m: Message): boolean =>
  !m.content.trim() && (!!m.attachments?.length || !!m.sticker_id || !!m.gif_url)

export function MessageItem({ item, timeZone }: MessageItemProps) {
  const { message, showHeader, dayLabel } = item
  const name = message.author?.display_name ?? 'Usuário'
  return (
    <View>
      {dayLabel ? (
        <View style={styles.day}>
          <View style={styles.line} />
          <Text style={styles.dayText}>{dayLabelText(dayLabel)}</Text>
          <View style={styles.line} />
        </View>
      ) : null}
      <View style={[styles.row, showHeader && styles.withHeader]}>
        <View style={styles.gutter}>
          {showHeader ? <Avatar name={name} uri={message.author?.avatar_url} size={40} /> : null}
        </View>
        <View style={styles.body}>
          {showHeader ? (
            <View style={styles.head}>
              <Text style={styles.author}>{name}</Text>
              <Text style={styles.time}>{timeText(message.created_at, timeZone)}</Text>
            </View>
          ) : null}
          {hasUnsupportedOnly(message) ? (
            <Text style={styles.unsupported}>Anexo (ainda não aparece no app)</Text>
          ) : (
            <Text style={styles.content}>
              {message.content}
              {message.edited_at ? <Text style={styles.edited}> (editada)</Text> : null}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: 1 },
  withHeader: { marginTop: spacing.md },
  gutter: { width: 40, marginRight: spacing.md },
  body: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  author: { color: colors.textStrong, fontSize: fontSize.md, fontWeight: '700' },
  time: { color: colors.textFaint, fontSize: fontSize.xs },
  content: { color: colors.textNormal, fontSize: fontSize.md, lineHeight: 22 },
  edited: { color: colors.textFaint, fontSize: fontSize.xs },
  unsupported: { color: colors.textMuted, fontSize: fontSize.sm, fontStyle: 'italic' },
  day: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  dayText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' }
})
