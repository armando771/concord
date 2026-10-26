import { messageSkeletonRows, pct } from '../../../shared/lib/skeleton'
import { Skeleton } from '../../../shared/ui/skeleton/Skeleton'

const ROWS = messageSkeletonRows(3, 23)

/**
 * Topo da lista enquanto há mensagens antigas: o lugar onde a próxima página
 * vai entrar, e o sentinela do scroll infinito. Tem a mesma altura carregando
 * ou não, então a lista nunca pula quando o carregamento começa ou termina.
 */
export default function OlderMessagesLoader({
  ref,
  visible,
  loading
}: {
  ref: React.Ref<HTMLDivElement>
  /** Há páginas antigas por vir. */
  visible: boolean
  loading: boolean
}): React.JSX.Element | null {
  if (!visible) return null
  return (
    <div ref={ref} aria-busy={loading} className="flex flex-col py-2">
      <span role="status" className="sr-only">
        {loading ? 'Carregando mensagens anteriores' : ''}
      </span>
      {ROWS.map((row, i) => (
        <div key={i} className="flex shrink-0 gap-3 px-4 py-1.5">
          <Skeleton circle className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <div className="flex h-[22px] items-center gap-2">
              <Skeleton className="h-3.5" style={{ width: row.namePx }} />
              <Skeleton className="h-2.5 w-12" />
            </div>
            {row.lines.map((w, j) => (
              <div key={j} className="flex h-[22px] items-center">
                <Skeleton className="h-3.5" style={pct(w)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
