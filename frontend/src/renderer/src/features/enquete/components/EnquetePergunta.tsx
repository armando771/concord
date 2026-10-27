import { useId } from 'react'
import type { Enquete } from '../api/enquete'
import { useEnqueteStore } from '../store/enqueteStore'
import EnqueteCamada from './EnqueteCamada'

const BOTAO =
  'flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-center rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-60'

/** A pergunta: opções iguais (rádios) e "Continuar" só com uma marcada. */
function EnquetePergunta({ enquete }: { enquete: Enquete }): React.JSX.Element {
  const selecao = useEnqueteStore((s) => s.selecao)
  const selecionar = useEnqueteStore((s) => s.selecionar)
  const continuar = useEnqueteStore((s) => s.continuar)
  const titleId = useId()

  return (
    <EnqueteCamada titleId={titleId}>
      <h2 id={titleId} className="text-balance text-lg font-bold text-strong">
        {enquete.titulo}
      </h2>
      <p className="mt-2 text-sm text-gray-400">{enquete.descricao}</p>
      <fieldset className="mt-5 flex flex-col gap-2 text-left">
        <legend className="sr-only">{enquete.titulo}</legend>
        {enquete.opcoes.map((o) => (
          <label
            key={o.id}
            className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 rounded-xl border border-subtle bg-surface px-4 text-sm font-bold text-gray-200 transition-colors hover:bg-white/10 has-[:checked]:border-violet-400 has-[:checked]:bg-violet-600/20 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet-400"
          >
            <input
              type="radio"
              name={enquete.id}
              value={o.id}
              checked={selecao === o.id}
              onChange={() => selecionar(o.id)}
              className="h-4 w-4 accent-violet-500"
            />
            {o.rotulo}
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        disabled={!selecao}
        onClick={continuar}
        className={`${BOTAO} mt-5 bg-violet-600 text-white hover:bg-violet-500`}
      >
        Continuar
      </button>
    </EnqueteCamada>
  )
}

export default EnquetePergunta
