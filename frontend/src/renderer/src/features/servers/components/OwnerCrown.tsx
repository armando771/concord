import { CrownIcon } from '../../../shared/ui/iconsExtra'

/**
 * Coroa ao lado do nome do dono do servidor. O dono não é um cargo: ele aparece
 * com o cargo que tiver (cor e grupo) e esta marca diz quem manda.
 */
export default function OwnerCrown({
  className = 'h-3.5 w-3.5'
}: {
  className?: string
}): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label="Dono do servidor"
      title="Dono do servidor"
      className="inline-flex shrink-0 items-center text-warning"
    >
      <CrownIcon className={className} />
    </span>
  )
}
