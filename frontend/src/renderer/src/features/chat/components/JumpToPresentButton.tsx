import { ArrowUpIcon } from '../../../shared/ui/icons'
import { jumpLabel, newCountText } from '../lib/jumpToPresent'

/**
 * Botão redondo com seta para baixo, no canto direito logo acima do campo de
 * mensagem (position: absolute em relação à caixa do composer, então acompanha
 * a altura da resposta/anexos sem cobrir o campo). Com mensagens novas embaixo
 * mostra a contagem no selo.
 *
 * Escondido ele continua no DOM, só transparente e `invisible`: dá para
 * animar a saída, e visibility tira o botão do Tab e do toque. Com
 * prefers-reduced-motion não há transição.
 */
export default function JumpToPresentButton({
  visible,
  newCount,
  onClick
}: {
  visible: boolean
  /** Mensagens novas chegadas enquanto a lista estava rolada para cima. */
  newCount: number
  onClick: () => void
}): React.JSX.Element {
  const badge = newCountText(newCount)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={jumpLabel(newCount)}
      title="Voltar às mensagens recentes"
      className={`absolute bottom-full right-4 z-30 mb-3 flex size-10 cursor-pointer items-center justify-center rounded-full border border-subtle bg-floating text-strong shadow-lg outline-none transition-[opacity,transform,visibility,background-color] duration-200 hover:bg-brand hover:text-white focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none ${
        visible
          ? 'visible translate-y-0 opacity-100'
          : 'invisible pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUpIcon className="size-5 rotate-180" />
      {badge && (
        <span
          data-new-count
          aria-hidden="true"
          className="absolute -right-1 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold leading-none text-white"
        >
          {badge}
        </span>
      )}
    </button>
  )
}
