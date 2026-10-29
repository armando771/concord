import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNetworkStore } from '../../../shared/store/networkStore'
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '../../../shared/theme/tokens'
import type { SendOutcome } from '../hooks/useRoomMessages'

interface ComposerProps {
  /** Texto do campo (e rótulo para leitor de tela), ex.: "Mensagem para #geral". */
  label: string
  onSend: (text: string) => Promise<SendOutcome>
  /** Aviso do 403 (sem permissão); sem ele, vale o aviso genérico de falha. */
  forbiddenNotice?: string
}

const SEND_FAILED = 'Não foi possível enviar. Tente de novo.'

/** Campo de envio do chat: texto, botão Enviar e aviso de falha (o texto volta ao campo). */
export function Composer({ label, onSend, forbiddenNotice }: ComposerProps) {
  const online = useNetworkStore((s) => s.online)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const canSend = online && !sending && text.trim().length > 0

  async function submit(): Promise<void> {
    if (!canSend) return
    setSending(true)
    setNotice(null)
    const outcome = await onSend(text)
    setSending(false)
    if (outcome === 'ok') setText('')
    else setNotice(outcome === 'forbidden' ? (forbiddenNotice ?? SEND_FAILED) : SEND_FAILED)
  }

  return (
    <View style={styles.container}>
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <View style={styles.row}>
        <TextInput
          accessibilityLabel={label}
          placeholder={label}
          placeholderTextColor={colors.textFaint}
          value={text}
          onChangeText={setText}
          multiline
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={() => void submit()}
          style={[styles.send, !canSend && styles.sendOff]}
        >
          <Text style={styles.sendText}>Enviar</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.bgPrimary },
  notice: { color: colors.textDanger, fontSize: fontSize.sm, paddingHorizontal: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: { flex: 1, maxHeight: 120, minHeight: MIN_TOUCH, borderRadius: radius.lg, backgroundColor: colors.bgInput, color: colors.textNormal, fontSize: fontSize.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  send: { minHeight: MIN_TOUCH, borderRadius: radius.lg, backgroundColor: colors.brand, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
  sendText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md }
})
