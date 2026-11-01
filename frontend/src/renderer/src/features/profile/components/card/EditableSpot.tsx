import type { ReactNode } from 'react'
import { PencilIcon } from '../../../../shared/ui/icons'
import { SPOT_LABEL, type CardSpot } from '../../lib/cardSpots'

/**
 * Parte do cartão que abre o editor dela (só na prévia de Configurações →
 * Perfis). O botão cobre a parte inteira e o conteúdo continua igual ao
 * que os outros veem. O lápis fica sempre à mostra no toque; com mouse,
 * aparece no hover e no foco do teclado.
 */
export default function EditableSpot({
  spot,
  onEdit,
  className = '-mx-1.5 px-1.5',
  children
}: {
  spot: CardSpot
  onEdit?: (spot: CardSpot) => void
  className?: string
  children: ReactNode
}): React.JSX.Element {
  if (!onEdit) return <>{children}</>
  const label = SPOT_LABEL[spot]
  return (
    <div
      className={`group/spot pointer-events-auto relative rounded-md transition-colors hover:bg-fg/5 ${className}`}
    >
      {children}
      <button
        type="button"
        onClick={() => onEdit(spot)}
        aria-label={label}
        title={label}
        className="absolute inset-0 z-10 cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-1 top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-md bg-black/60 text-white shadow transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/spot:opacity-100 [@media(hover:hover)]:group-has-[:focus-visible]/spot:opacity-100"
      >
        <PencilIcon className="size-3.5" />
      </span>
    </div>
  )
}
