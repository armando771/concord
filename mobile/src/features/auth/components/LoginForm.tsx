import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import { Input } from '../../../shared/ui/Input'
import { TextLink } from '../../../shared/ui/TextLink'
import { colors, fontSize, spacing } from '../../../shared/theme/tokens'
import { authDeps } from '../lib/authDeps'
import { hasFieldErrors, loginFieldErrors, runLogin, type AuthDeps, type LoginFieldErrors } from '../lib/authFlow'
import { buildLoginInput } from '../lib/loginIdentifier'
import { useAuthStore } from '../store/authStore'

const INVALID_LOGIN = 'Login ou senha inválidos.'
const NO_ERRORS: LoginFieldErrors = { identifier: null, password: null }

interface LoginFormProps {
  deps?: AuthDeps
  onRegister: () => void
  onForgotPassword: () => void
}

export function LoginForm({ deps = authDeps, onRegister, onForgotPassword }: LoginFormProps) {
  const notice = useAuthStore((s) => s.notice)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginFieldErrors>(NO_ERRORS)
  const [failure, setFailure] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(): Promise<void> {
    const fieldErrors = loginFieldErrors(identifier, password)
    setErrors(fieldErrors)
    setFailure(null)
    if (hasFieldErrors(fieldErrors)) return
    setLoading(true)
    const outcome = await runLogin(deps, buildLoginInput(identifier, password))
    setLoading(false)
    if (outcome.kind === 'invalid') setErrors({ identifier: INVALID_LOGIN, password: INVALID_LOGIN })
    else if (outcome.kind === 'error') setFailure(outcome.message)
  }

  return (
    <View style={styles.form}>
      <View>
        <Text style={styles.title}>Boas-vindas de volta!</Text>
        <Text style={styles.subtitle}>Que bom te ver de novo na Salinha.</Text>
      </View>
      {notice ? <Banner tone="info" message={notice} /> : null}
      <Input
        label="E-mail ou nome de usuário"
        value={identifier}
        onChangeText={setIdentifier}
        error={errors.identifier}
        autoCapitalize="none"
        autoComplete="username"
        autoCorrect={false}
      />
      <Input
        label="Senha"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="current-password"
      />
      <TextLink title="Esqueceu a senha?" onPress={onForgotPassword} />
      {failure ? <Banner message={failure} /> : null}
      <Button title="Entrar" onPress={submit} loading={loading} />
      <View style={styles.footer}>
        <Text style={styles.subtitle}>Precisando de uma conta?</Text>
        <TextLink title="Registre-se" onPress={onRegister} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  title: { color: colors.textStrong, fontSize: fontSize.xl, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }
})
