import { useState } from 'react'
import Button from '../../../../shared/ui/Button'
import Modal from '../../../../shared/ui/Modal'
import { showToast } from '../../../../shared/store/toastStore'
import type { Birthday } from '../../../profile/api/birthdays'
import BirthdayFields from '../../../profile/components/BirthdayFields'
import { birthdayError } from '../../../profile/lib/birthday'
import { Toggle } from '../Toggle'

/** Aniversário (opcional) e se os servidores podem anunciar. Salva em "Salvar". */
export default function BirthdayEditModal({
  initial,
  onSave,
  onClose
}: {
  initial: Birthday
  /** Devolve a mensagem de erro (null = salvou). */
  onSave: (next: Birthday) => Promise<string | null>
  onClose: () => void
}): React.JSX.Element {
  const [value, setValue] = useState(initial)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const invalid = birthdayError(value)

  const submit = async (): Promise<void> => {
    setBusy(true)
    const error = await onSave(value)
    setBusy(false)
    setFailure(error)
    if (!error) {
      showToast.success('Aniversário salvo!')
      onClose()
    }
  }

  return (
    <Modal open title="Aniversário" onClose={busy ? undefined : onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <BirthdayFields value={value} onChange={(next) => setValue({ ...value, ...next })} />
        {invalid && <p className="text-xs text-amber-300">{invalid}</p>}
        <p className="text-ds-xs text-gray-500">
          Sua idade aparece só para você, no recado de feliz aniversário.
        </p>
        <Toggle
          title="Anunciar meu aniversário nos servidores"
          description="No seu dia, os servidores mandam uma mensagem de parabéns no canal principal e você vê um recado ao abrir o app."
          checked={value.announce}
          onChange={() => setValue({ ...value, announce: !value.announce })}
        />
        {failure && (
          <p role="alert" className="text-xs text-danger">
            {failure}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy} className="min-h-10">
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || Boolean(invalid)} className="min-h-10">
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
