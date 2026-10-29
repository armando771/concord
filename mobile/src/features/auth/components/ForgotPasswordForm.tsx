import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import { Input } from '../../../shared/ui/Input'
import { TextLink } from '../../../shared/ui/TextLink'
import { colors, fontSize, spacing } from '../../../shared/theme/tokens'
import { authDeps } from '../lib/authDeps'
import { runForgotPassword, type AuthDeps } from '../lib/authFlow'
import { emailError } from '../lib/authForms'

interface ForgotPasswordFormProps {
  deps?: AuthDeps
  onBack: () => void
}

export function ForgotPasswordForm({ deps = authDeps, onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(): Promise<void> {
    const invalid = emailError(email)
    setFieldError(invalid)
    setFailure(null)
    if (invalid) return
    setLoading(true)
    const outcome = await runForgotPassword(deps, email)
    setLoading(false)
    if (outcome.kind === 'error') setFailure(outcome.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <View style={styles.form}>
        <Text style={styles.title}>Confira seu e-mail</Text>
        <Text style={styles.body}>
          Se existir uma conta com {email.trim()}, enviamos um link para redefinir a senha. Ele vale por 1 hora. Veja
          também a caixa de spam.
        </Text>
        <TextLink title="Voltar para o login" onPress={onBack} />
      </View>
    )
  }

  return (
    <View style={styles.form}>
      <View>
        <Text style={styles.title}>Esqueceu a senha?</Text>
        <Text style={styles.subtitle}>Digite o e-mail da sua conta e enviaremos um link para criar uma nova senha.</Text>
      </View>
      <Input
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={fieldError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
      />
      {failure ? <Banner message={failure} /> : null}
      <Button title="Enviar link" onPress={submit} loading={loading} />
      <TextLink title="Voltar para o login" onPress={onBack} />
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  title: { color: colors.textStrong, fontSize: fontSize.xl, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  body: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 }
})
