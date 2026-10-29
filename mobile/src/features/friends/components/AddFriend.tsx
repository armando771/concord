import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { spacing } from '../../../shared/theme/tokens'
import { Banner } from '../../../shared/ui/Banner'
import { Button } from '../../../shared/ui/Button'
import { Input } from '../../../shared/ui/Input'
import { addFailureMessage, addSuccessMessage } from '../lib/friendLists'
import { useFriendsStore } from '../store/friendsStore'

/** "Adicionar amigo" por nome de usuário: pedido enviado, amizade na hora ou o erro do servidor. */
export function AddFriend() {
  const [username, setUsername] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ tone: 'info' | 'error'; message: string } | null>(null)
  const name = username.trim()

  async function submit(): Promise<void> {
    setSending(true)
    setResult(null)
    const outcome = await useFriendsStore.getState().send(name)
    setSending(false)
    setResult(
      outcome.kind === 'ok'
        ? { tone: 'info', message: addSuccessMessage(outcome.result, name) }
        : { tone: 'error', message: addFailureMessage(outcome.error) }
    )
  }

  return (
    <View style={styles.form}>
      <Input
        label="Nome de usuário"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button title="Enviar pedido" onPress={() => void submit()} loading={sending} disabled={!name} />
      {result ? <Banner tone={result.tone} message={result.message} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, padding: spacing.lg }
})
