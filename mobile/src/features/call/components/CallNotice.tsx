import { StyleSheet, View } from 'react-native'
import { spacing } from '../../../shared/theme/tokens'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import { useCallNoticeStore } from '../store/callNoticeStore'

const MIC_DENIED = 'Sem permissão do microfone. Você entrou mudo.'

interface CallNoticeProps {
  /** Abre as configurações do Android (aviso de microfone negado). */
  onOpenSettings?: () => void
}

/** Aviso curto da chamada ("Sala trancada", "Fulano recusou a chamada"), com Fechar. */
export function CallNotice({ onOpenSettings }: CallNoticeProps) {
  const message = useCallNoticeStore((s) => s.message)
  const dismiss = useCallNoticeStore((s) => s.dismiss)
  if (!message) return null
  return (
    <View style={styles.box}>
      <Banner message={message} />
      {message === MIC_DENIED && onOpenSettings ? <Button title="Abrir configurações" variant="secondary" onPress={onOpenSettings} /> : null}
      <Button title="Fechar aviso" variant="secondary" onPress={dismiss} />
    </View>
  )
}

const styles = StyleSheet.create({ box: { gap: spacing.sm, padding: spacing.md } })
