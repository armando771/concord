import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '../../../shared/ui/icons'
import { HUB_PATH } from '../lib/hub'

// O primeiro <header> da página abre espaço à esquerda para o "voltar" e rola
// na horizontal se os botões não couberem.
const FRAME =
  'relative h-full w-full [&_header]:overflow-x-auto [&_header]:pl-14 [&_header>*]:shrink-0'

/**
 * Moldura das telas da aba do diamante (Propostas, Novidades, Rank global):
 * põe o "voltar para Melhorias" no canto do cabeçalho delas, sem mexer na
 * página. No celular elas não têm o botão de canais; o caminho é voltar ao hub.
 */
function HubBackFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={FRAME}>
      {children}
      <Link
        to={HUB_PATH}
        aria-label="Voltar para Melhorias"
        title="Voltar para Melhorias"
        className="absolute left-4 top-2 z-10 flex size-10 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-fg/10 hover:text-strong focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <ArrowLeftIcon className="size-5" />
      </Link>
    </div>
  )
}

export default HubBackFrame
