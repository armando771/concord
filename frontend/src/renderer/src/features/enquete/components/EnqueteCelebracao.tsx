import { useId } from 'react'
import BadgeIcon from '../../levels/components/BadgeIcon'
import { rarityMeta } from '../../levels/lib/badges'
import { useFecharEm } from '../hooks/useFecharEm'
import { CELEBRACAO_MS } from '../lib/enquete'
import { useEnqueteStore } from '../store/enqueteStore'
import EnqueteCamada from './EnqueteCamada'

// Os badges de enquete são todos Lendários (internal/badge/catalog.go).
const RARIDADE = 'lendario'

/**
 * O badge ganho em tamanho grande, com raios e brilho (parados com
 * prefers-reduced-motion). Fecha sozinho, ao tocar fora ou com Esc.
 */
function EnqueteCelebracao({
  badge,
  rotulo
}: {
  badge: string
  rotulo: string
}): React.JSX.Element {
  const fechar = useEnqueteStore((s) => s.fecharReacao)
  const titleId = useId()
  const cor = rarityMeta(RARIDADE).color
  useFecharEm(CELEBRACAO_MS, fechar)

  return (
    <EnqueteCamada titleId={titleId} onFechar={fechar}>
      <div className="relative mx-auto flex h-56 w-56 max-w-full items-center justify-center">
        <div aria-hidden="true" className="enquete-raios absolute inset-[-40%]" />
        <div
          aria-hidden="true"
          className="enquete-brilho absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle, ${cor}66 0%, transparent 70%)` }}
        />
        <BadgeIcon
          category={badge}
          tier={1}
          rarity={RARIDADE}
          size={224}
          className="enquete-badge relative max-w-full"
        />
      </div>
      <h2 id={titleId} className="mt-4 text-balance text-xl font-bold text-strong">
        Badge conquistado!
      </h2>
      <p className="mt-1 text-sm font-bold" style={{ color: cor }}>
        {rotulo}
      </p>
    </EnqueteCamada>
  )
}

export default EnqueteCelebracao
