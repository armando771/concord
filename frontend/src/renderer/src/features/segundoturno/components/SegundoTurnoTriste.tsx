import { useId } from 'react'
import { useFecharEm } from '../hooks/useFecharEm'
import { TRISTE_MS } from '../lib/segundoTurno'
import { useSegundoTurnoStore } from '../store/segundoTurnoStore'
import SegundoTurnoCamada from './SegundoTurnoCamada'

/** A reação a quem não fez o L: um rosto triste que murcha e uma frase curta. */
function SegundoTurnoTriste(): React.JSX.Element {
  const fechar = useSegundoTurnoStore((s) => s.fecharReacao)
  const titleId = useId()
  useFecharEm(TRISTE_MS, fechar)

  return (
    <SegundoTurnoCamada titleId={titleId} onFechar={fechar}>
      <span aria-hidden="true" className="segundo-turno-triste mx-auto block text-7xl">
        😢
      </span>
      <h2 id={titleId} className="mt-4 text-balance text-base font-bold text-strong">
        Poxa… tudo bem, cada um com a sua escolha.
      </h2>
      <button
        type="button"
        onClick={fechar}
        className="mt-5 flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-center rounded-xl border border-subtle bg-surface px-4 text-sm font-bold text-gray-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        Fechar
      </button>
    </SegundoTurnoCamada>
  )
}

export default SegundoTurnoTriste
