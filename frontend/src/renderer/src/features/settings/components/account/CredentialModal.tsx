import { useState } from 'react'
import Button from '../../../../shared/ui/Button'
import Modal from '../../../../shared/ui/Modal'
import { showToast } from '../../../../shared/store/toastStore'
import { submitAccountChange, type AccountField } from '../../../auth/lib/accountChange'
import { changeMyEmail, changeMyUsername } from '../../../auth/store/accountActions'
import { Field, inputClass } from '../profile/ProfileField'

interface CredentialConfig {
  title: string
  label: string
  hint: string
  type: 'text' | 'email'
  autoComplete: string
  success: string
  send: (value: string, password: string) => Promise<void>
}

const CREDENTIALS: Record<AccountField, CredentialConfig> = {
  username: {
    title: 'Mudar o nome de usuário',
    label: 'Nome de usuário',
    hint: 'De 3 a 32 caracteres: letras, números ou _. É o seu @ no app e serve para entrar.',
    type: 'text',
    autoComplete: 'username',
    success: 'Nome de usuário trocado!',
    send: changeMyUsername
  },
  email: {
    title: 'Mudar o e-mail',
    label: 'E-mail',
    hint: 'Vamos mandar um link de confirmação para o novo endereço.',
    type: 'email',
    autoComplete: 'email',
    success: 'E-mail trocado! Confira a caixa de entrada para confirmar.',
    send: changeMyEmail
  }
}

/** Troca o @ ou o e-mail: o valor novo e a senha atual (exigida pelo servidor). */
export default function CredentialModal({
  kind,
  current,
  onClose
}: {
  kind: AccountField
  current: string
  onClose: () => void
}): React.JSX.Element {
  const config = CREDENTIALS[kind]
  const [value, setValue] = useState(current)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    setBusy(true)
    const failure = await submitAccountChange({ kind, value, password, current, send: config.send })
    setBusy(false)
    setError(failure)
    if (!failure) {
      showToast.success(config.success)
      onClose()
    }
  }

  return (
    <Modal open title={config.title} onClose={busy ? undefined : onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Field label={config.label} hint={config.hint}>
          <input
            value={value}
            type={config.type}
            autoComplete={config.autoComplete}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
            aria-label={config.label}
            autoFocus
          />
        </Field>
        <Field label="Senha atual">
          <input
            value={password}
            type="password"
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            aria-label="Senha atual"
          />
        </Field>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy} className="min-h-10">
            Cancelar
          </Button>
          <Button type="submit" disabled={busy} className="min-h-10">
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
