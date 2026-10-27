import { PlusIcon } from '../../../../shared/ui/icons'

/**
 * Nota: o balão ao lado da foto, como no Discord. No próprio perfil sem nota,
 * o convite para adicionar uma.
 */
export default function CardNote({
  note,
  onAdd
}: {
  note?: string
  onAdd?: () => void
}): React.JSX.Element | null {
  if (!note && !onAdd) return null
  return (
    <div className="pointer-events-auto relative mt-[38px] min-w-0">
      <span
        aria-hidden="true"
        className="absolute -left-2.5 top-1 h-3 w-3 rounded-full border border-subtle bg-primary"
      />
      <span
        aria-hidden="true"
        className="absolute -left-4 -top-0.5 h-1.5 w-1.5 rounded-full border border-subtle bg-primary"
      />
      {note ? (
        <p className="relative max-w-[170px] break-words rounded-2xl border border-subtle bg-primary px-3 py-2 text-xs leading-snug text-gray-200 shadow-lg">
          {note}
        </p>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="relative flex max-w-[170px] cursor-pointer items-center gap-1.5 rounded-2xl border border-subtle bg-primary px-3 py-2 text-left text-xs italic text-gray-400 shadow-lg transition-colors hover:text-gray-200"
        >
          <PlusIcon className="h-3.5 w-3.5 shrink-0 rounded-full bg-gray-400 p-0.5 text-[var(--bg-floating)]" />
          Adicionar uma nota
        </button>
      )}
    </div>
  )
}
