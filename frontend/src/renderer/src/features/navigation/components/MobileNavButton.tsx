import { ArrowLeftIcon } from '../../../shared/ui/iconsExtra'
import { useMobileNavStore } from '../store/mobileNavStore'

/**
 * Começo do cabeçalho no celular: volta para a lista de canais/conversas.
 * Some do `md` em diante (lá a lista está sempre do lado).
 */
function MobileNavButton({ className = '' }: { className?: string }): React.JSX.Element {
  const showNav = useMobileNavStore((s) => s.showNav)
  return (
    <button
      type="button"
      onClick={showNav}
      aria-label="Voltar para canais e conversas"
      title="Canais e conversas"
      className={`-ml-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-fg/10 hover:text-strong focus-visible:outline-2 focus-visible:outline-violet-400 md:hidden ${className}`}
    >
      <ArrowLeftIcon className="size-5" />
    </button>
  )
}

export default MobileNavButton
