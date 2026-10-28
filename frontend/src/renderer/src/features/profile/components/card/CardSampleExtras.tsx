import { DotsIcon } from '../../../../shared/ui/icons'
import { formatMemberSince } from '../../lib/profileCard'

// O pé do cartão como os outros veem, na prévia do editor de perfil: o
// "Membro desde" e os botões de quem visita (só de enfeite: na prévia não
// fazem nada e ficam fora do Tab).

/** "Membro desde" no Salinha (a caixa cinza do cartão). */
export function CardMemberSince({ createdAt }: { createdAt?: string }): React.JSX.Element | null {
  const since = formatMemberSince(createdAt)
  if (!since) return null
  return (
    <div className="mt-3 rounded-lg bg-input p-3">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
        Membro desde
      </p>
      <p className="text-xs text-gray-200">
        {since} <span className="text-gray-500">· no Salinha</span>
      </p>
    </div>
  )
}

/** Os botões de quem abre o seu perfil (mensagem e o menu), inertes na prévia. */
export function CardVisitorButtons(): React.JSX.Element {
  return (
    <div inert aria-hidden="true" className="mt-3 flex gap-2">
      <span className="flex flex-1 items-center justify-center rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white">
        Enviar mensagem
      </span>
      <span className="flex items-center justify-center rounded-lg bg-fg/10 px-2.5 text-gray-200">
        <DotsIcon className="h-4 w-4" />
      </span>
    </div>
  )
}
