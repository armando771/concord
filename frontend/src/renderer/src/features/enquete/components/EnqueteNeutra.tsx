import { useId } from 'react'
import { useFecharEm } from '../hooks/useFecharEm'
import { NEUTRA_MS } from '../lib/enquete'
import { useEnqueteStore } from '../store/enqueteStore'
import EnqueteCamada from './EnqueteCamada'

/** Para quem preferiu não dizer: só confirma que a escolha foi guardada. */
function EnqueteNeutra(): React.JSX.Element {
  const fechar = useEnqueteStore((s) => s.fecharReacao)
  const titleId = useId()
  useFecharEm(NEUTRA_MS, fechar)

  return (
    <EnqueteCamada titleId={titleId} onFechar={fechar}>
      <h2 id={titleId} className="text-balance text-base font-bold text-strong">
        Tudo certo! Sua escolha foi guardada.
      </h2>
      <button
        type="button"
        onClick={fechar}
        className="mt-5 flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-center rounded-xl border border-subtle bg-surface px-4 text-sm font-bold text-gray-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        Fechar
      </button>
    </EnqueteCamada>
  )
}

export default EnqueteNeutra
