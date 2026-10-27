import { useId } from 'react'
import type { Enquete } from '../api/enquete'
import { achaOpcao } from '../lib/enquete'
import { useEnqueteStore } from '../store/enqueteStore'
import EnqueteCamada from './EnqueteCamada'

const BOTAO =
  'flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-center rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1'

/** "Confirmar: Fez o L?": a escolha é definitiva, então pede um segundo toque. */
function EnqueteConfirmacao({ enquete }: { enquete: Enquete }): React.JSX.Element {
  const selecao = useEnqueteStore((s) => s.selecao)
  const enviando = useEnqueteStore((s) => s.enviando)
  const erro = useEnqueteStore((s) => s.erro)
  const confirmar = useEnqueteStore((s) => s.confirmar)
  const voltar = useEnqueteStore((s) => s.voltar)
  const titleId = useId()
  const rotulo = achaOpcao(enquete, selecao ?? '')?.rotulo ?? ''

  return (
    <EnqueteCamada titleId={titleId}>
      <h2 id={titleId} className="text-balance text-lg font-bold text-strong">
        Confirmar: {rotulo}?
      </h2>
      <p className="mt-2 text-sm text-gray-400">Não dá para mudar depois.</p>
      {erro && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          Não foi possível enviar. Tente de novo.
        </p>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={enviando}
          onClick={() => void confirmar()}
          className={`${BOTAO} bg-violet-600 text-white hover:bg-violet-500`}
        >
          Confirmar
        </button>
        <button
          type="button"
          disabled={enviando}
          data-autofocus
          onClick={voltar}
          className={`${BOTAO} border border-subtle bg-surface text-gray-200 hover:bg-white/10`}
        >
          Voltar
        </button>
      </div>
    </EnqueteCamada>
  )
}

export default EnqueteConfirmacao
