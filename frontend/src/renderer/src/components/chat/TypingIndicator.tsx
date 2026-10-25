import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '../../store/authStore'
import { useTypingStore } from '../../store/typingStore'
import { useServerNicknames } from '../../store/useServerNames'
import { typersIn, typingSegments } from '../../lib/typing'
import { serverDisplayName } from '../../lib/serverNames'

/**
 * Linha "Fulano está digitando…" embaixo do campo. A altura fica reservada
 * mesmo vazia, para o chat não pular quando ela aparece. Num canal de
 * servidor (serverId), quem tem apelido aparece pelo apelido.
 */
function TypingIndicator({
  room,
  serverId
}: {
  room: string
  serverId?: string
}): React.JSX.Element {
  const meId = useAuthStore((s) => s.user?.id)
  const nicknames = useServerNicknames(serverId)
  // Só os nomes desta sala: aviso em outra sala (ou renovação sem mudança)
  // não redesenha a linha.
  const names = useTypingStore(
    useShallow((s) =>
      typersIn(s.byRoom, room, meId).map((t) =>
        serverDisplayName({ nickname: nicknames?.[t.userId] }, { display_name: t.name })
      )
    )
  )
  const segments = typingSegments(names)

  return (
    <div
      aria-live="polite"
      className="flex h-6 min-w-0 items-center gap-1.5 px-1 text-xs text-gray-400"
    >
      {segments.length > 0 && (
        <>
          <span aria-hidden className="typing-dots flex shrink-0 items-center gap-0.5">
            <span />
            <span />
            <span />
          </span>
          <span className="truncate">
            {segments.map((s, i) =>
              s.bold ? (
                <strong key={i} className="font-semibold text-gray-200">
                  {s.text}
                </strong>
              ) : (
                <span key={i}>{s.text}</span>
              )
            )}
          </span>
        </>
      )}
    </div>
  )
}

export default TypingIndicator
