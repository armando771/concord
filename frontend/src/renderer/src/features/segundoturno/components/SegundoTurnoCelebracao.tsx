import { useId } from 'react'
import BadgeIcon from '../../levels/components/BadgeIcon'
import { rarityMeta } from '../../levels/lib/badges'
import { useFecharEm } from '../hooks/useFecharEm'
import { CELEBRACAO_MS } from '../lib/segundoTurno'
import { useSegundoTurnoStore } from '../store/segundoTurnoStore'
import SegundoTurnoCamada from './SegundoTurnoCamada'

const RARIDADE = 'lendario'

/**
 * O badge "Fez o L" em tamanho grande, com raios e brilho (parados com
 * prefers-reduced-motion). Fecha sozinho, ao tocar fora ou com Esc.
 */
function SegundoTurnoCelebracao(): React.JSX.Element {
  const fechar = useSegundoTurnoStore((s) => s.fecharReacao)
  const titleId = useId()
  const cor = rarityMeta(RARIDADE).color
  useFecharEm(CELEBRACAO_MS, fechar)

  return (
    <SegundoTurnoCamada titleId={titleId} onFechar={fechar}>
      <div className="relative mx-auto flex h-56 w-56 max-w-full items-center justify-center">
        <div aria-hidden="true" className="segundo-turno-raios absolute inset-[-40%]" />
        <div
          aria-hidden="true"
          className="segundo-turno-brilho absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle, ${cor}66 0%, transparent 70%)` }}
        />
        <BadgeIcon
          category="l"
          tier={1}
          rarity={RARIDADE}
          size={224}
          className="segundo-turno-badge relative max-w-full"
        />
      </div>
      <h2 id={titleId} className="mt-4 text-balance text-xl font-bold text-strong">
        Badge conquistado!
      </h2>
      <p className="mt-1 text-sm font-bold" style={{ color: cor }}>
        Fez o L
      </p>
    </SegundoTurnoCamada>
  )
}

export default SegundoTurnoCelebracao
