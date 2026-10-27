import { useId } from 'react'
import { useSegundoTurnoStore } from '../store/segundoTurnoStore'
import SegundoTurnoCamada from './SegundoTurnoCamada'

const BOTAO =
  'flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-center rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1'

/**
 * "Você fez o L no segundo turno?" Sim dá o badge e abre a celebração, não
 * abre a reação triste; fechar (X, Esc ou clicar fora) deixa o botão na barra.
 */
function SegundoTurnoBanner(): React.JSX.Element {
  const enviando = useSegundoTurnoStore((s) => s.enviando)
  const erro = useSegundoTurnoStore((s) => s.erro)
  const responder = useSegundoTurnoStore((s) => s.responder)
  const dispensar = useSegundoTurnoStore((s) => s.dispensar)
  const titleId = useId()

  return (
    <SegundoTurnoCamada titleId={titleId} onFechar={dispensar}>
      <span
        aria-hidden="true"
        className="segundo-turno-letra mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-4xl font-black"
      >
        L
      </span>
      <h2 id={titleId} className="text-balance text-lg font-bold text-strong">
        Você fez o L no segundo turno?
      </h2>
      <p className="mt-2 text-sm text-gray-400">
        Conta pra gente. Quem fez o L ganha um badge exclusivo.
      </p>
      {erro && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          Não foi possível enviar. Tente de novo.
        </p>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={enviando}
          onClick={() => void responder(true)}
          className={`${BOTAO} bg-violet-600 text-white hover:bg-violet-500`}
        >
          Fiz o L
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => void responder(false)}
          className={`${BOTAO} border border-subtle bg-surface text-gray-200 hover:bg-white/10`}
        >
          Não fiz
        </button>
      </div>
    </SegundoTurnoCamada>
  )
}

export default SegundoTurnoBanner
