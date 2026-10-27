import { FriendsIcon } from '../../../shared/ui/icons'

/** Mostra ou esconde a lista de participantes do grupo. */
function MembersToggleButton({
  shown,
  onToggle
}: {
  shown: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={shown ? 'Ocultar lista de membros' : 'Mostrar lista de membros'}
      aria-label="Lista de membros"
      onClick={onToggle}
      className={`cursor-pointer hover:text-strong ${shown ? 'text-strong' : ''}`}
    >
      <FriendsIcon className="h-5 w-5" />
    </button>
  )
}

export default MembersToggleButton
