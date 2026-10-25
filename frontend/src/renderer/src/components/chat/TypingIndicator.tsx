import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '../../store/authStore'
import { useTypingStore } from '../../store/typingStore'
import { typersIn, typingSegments } from '../../lib/typing'

/**
 * Linha "Fulano está digitando…" embaixo do campo. A altura fica reservada
 * mesmo vazia, para o chat não pular quando ela aparece.
 */
function TypingIndicator({ room }: { room: string }): React.JSX.Element {
  const meId = useAuthStore((s) => s.user?.id)
  // Só os nomes desta sala: aviso em outra sala (ou renovação sem mudança)
  // não redesenha a linha.
  const names = useTypingStore(useShallow((s) => typersIn(s.byRoom, room, meId).map((t) => t.name)))
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
