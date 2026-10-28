import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '../../../shared/ui/iconsExtra'
import { HUB_PATH } from '../lib/hub'

/** Começo do cabeçalho das telas da aba do diamante: volta para os 3 cards. */
function HubBackButton(): React.JSX.Element {
  return (
    <Link
      to={HUB_PATH}
      aria-label="Voltar para Melhorias"
      title="Voltar para Melhorias"
      className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-fg/10 hover:text-strong focus-visible:outline-2 focus-visible:outline-violet-400"
    >
      <ArrowLeftIcon className="size-5" />
    </Link>
  )
}

export default HubBackButton
