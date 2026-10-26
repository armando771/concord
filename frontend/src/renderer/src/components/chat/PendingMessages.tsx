import { useChatStore, type RoomKey } from '../../store/chatStore'
import type { PendingMessage } from '../../lib/pendingMessages'

const EMPTY: PendingMessage[] = []

/**
 * Minhas mensagens que o servidor ainda não confirmou, no fim do chat:
 * "Enviando…" enquanto esperam e "Não enviada — tentar de novo" se a rede
 * falhou (o texto nunca se perde).
 */
function PendingMessages({ room }: { room: RoomKey }): React.JSX.Element | null {
  const pending = useChatStore((s) => s.pendingByRoom[room] ?? EMPTY)
  const retryPending = useChatStore((s) => s.retryPending)
  const discardPending = useChatStore((s) => s.discardPending)
  if (pending.length === 0) return null
  return (
    <ul aria-label="Mensagens sendo enviadas" className="flex flex-col">
      {pending.map((item) => {
        const failed = item.status === 'failed'
        return (
          <li
            key={item.localId}
            data-testid="pending-message"
            data-status={item.status}
            className={`rounded-md px-4 py-1.5 pl-[3.75rem] ${failed ? 'bg-danger/[0.06]' : ''}`}
          >
            <p
              className={`whitespace-pre-wrap break-words text-ds-md ${
                failed ? 'text-secondary' : 'text-muted'
              }`}
            >
              {item.content}
            </p>
            {failed ? (
              <p role="alert" className="mt-0.5 flex flex-wrap items-center gap-x-2 text-ds-xs">
                <span className="font-semibold text-danger">
                  Não enviada{item.error ? ` — ${item.error}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => void retryPending(room, item.localId)}
                  className="cursor-pointer rounded font-semibold text-link outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Tentar de novo
                </button>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(item.content)}
                  className="cursor-pointer rounded text-muted outline-none hover:text-normal hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={() => discardPending(room, item.localId)}
                  className="cursor-pointer rounded text-muted outline-none hover:text-normal hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Descartar
                </button>
              </p>
            ) : (
              <p className="mt-0.5 text-ds-xs text-faint" aria-live="polite">
                Enviando…
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default PendingMessages
