import type { MentionEveryone } from '../../api/messages'
import { messageParts } from '../../lib/linkify'

/**
 * Texto da mensagem: menções em chip e links clicáveis. É a única parte da
 * linha que dá para selecionar (o app inteiro é select-none); nome, hora e
 * botões continuam fora da seleção.
 *
 * O link abre no navegador de fora: na web pelo target="_blank"; no app o
 * mesmo target cai no setWindowOpenHandler, que só deixa passar http/https.
 */
function MessageText({
  content,
  everyone
}: {
  content: string
  everyone: MentionEveryone | null
}): React.JSX.Element {
  return (
    <p className="cursor-text select-text whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-200">
      {messageParts(content, everyone).map((part, i) =>
        part.href ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00a8fc] hover:underline"
          >
            {part.text}
          </a>
        ) : part.mention ? (
          <span key={i} className="rounded bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]">
            {part.text}
          </span>
        ) : (
          part.text
        )
      )}
    </p>
  )
}

export default MessageText
