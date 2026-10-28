import { useState } from 'react'
import Modal from '../../../shared/ui/Modal'
import Button from '../../../shared/ui/Button'
import Input from '../../../shared/ui/Input'
import {
  MAX_SAVED_PROFILE_NAME,
  savedProfileNameError,
  submitSavedName,
  type SavedProfile
} from '../lib/savedProfiles'

/**
 * Nome do perfil salvo: ao salvar o perfil atual e ao renomear. Fecha quando
 * o servidor confirma (onSubmit devolve true).
 */
export default function SavedProfileNameModal({
  title,
  submitLabel,
  initialName,
  list,
  ownId,
  busy,
  onSubmit,
  onClose
}: {
  title: string
  submitLabel: string
  initialName: string
  list: SavedProfile[]
  /** Renomeando: o próprio nome não conta como repetido. */
  ownId?: string
  busy: boolean
  onSubmit: (name: string) => Promise<boolean>
  onClose: () => void
}): React.JSX.Element {
  const [name, setName] = useState(initialName)
  const [touched, setTouched] = useState(false)
  const error = savedProfileNameError(name, list, ownId)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setTouched(true)
    if (await submitSavedName(name, error, busy, onSubmit)) onClose()
  }

  return (
    <Modal open title={title} onClose={busy ? undefined : onClose}>
      <form onSubmit={submit} noValidate>
        <Input
          label="Nome do perfil"
          value={name}
          maxLength={MAX_SAVED_PROFILE_NAME * 2}
          autoFocus
          autoComplete="off"
          error={touched ? error : null}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || Boolean(touched && error)}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
