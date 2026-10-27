import { useState } from 'react'
import { maskEmail } from '../../../auth/lib/account'

const editClass =
  'min-h-10 shrink-0 cursor-pointer rounded-md bg-fg/10 px-4 text-ds-sm font-medium text-strong transition-colors hover:bg-fg/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'

/** Uma linha de Minha conta: rótulo, valor e (se der para mudar) o "Editar". */
export function AccountRow({
  label,
  value,
  onEdit
}: {
  label: string
  value: React.ReactNode
  onEdit?: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-ds-sm font-medium text-gray-400">{label}</p>
        <div className="truncate text-ds-md text-strong">{value}</div>
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Editar ${label.toLowerCase()}`} className={editClass}>
          Editar
        </button>
      )}
    </div>
  )
}

/** E-mail mascarado ("*****@gmail.com"), com o "Mostrar", como no Discord. */
export function MaskedEmail({ email }: { email: string }): React.JSX.Element {
  const [show, setShow] = useState(false)
  return (
    <>
      {show ? email : maskEmail(email)}{' '}
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="cursor-pointer text-link hover:underline"
      >
        {show ? 'Ocultar' : 'Mostrar'}
      </button>
    </>
  )
}
