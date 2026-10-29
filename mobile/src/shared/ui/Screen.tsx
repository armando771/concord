import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, MAX_CONTENT_WIDTH, spacing } from '../theme/tokens'

interface ScreenProps {
  children: ReactNode
}

/**
 * Casca das telas de formulário: área segura, o teclado não cobre o campo
 * focado e o conteúdo centraliza com largura máxima (tablet, 768 px).
 */
export function Screen({ children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: spacing.lg }
})
