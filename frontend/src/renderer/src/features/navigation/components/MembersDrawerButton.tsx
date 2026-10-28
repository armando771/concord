import { MembersIcon } from '../../../shared/ui/iconsExtra'
import { useMobileNavStore } from '../store/mobileNavStore'

/**
 * Botão do cabeçalho que abre a gaveta de membros onde a coluna de membros
 * não cabe (abaixo do `lg`).
 */
function MembersDrawerButton(): React.JSX.Element {
  const open = useMobileNavStore((s) => s.membersOpen)
  const setOpen = useMobileNavStore((s) => s.setMembersOpen)
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label="Membros"
      aria-expanded={open}
      title="Membros"
      className={`flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-fg/10 hover:text-strong focus-visible:outline-2 focus-visible:outline-violet-400 lg:hidden ${
        open ? 'text-strong' : 'text-gray-400'
      }`}
    >
      <MembersIcon className="size-5" />
    </button>
  )
}

export default MembersDrawerButton
