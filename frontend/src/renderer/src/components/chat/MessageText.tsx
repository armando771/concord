import { memo, useMemo } from 'react'
import type { MentionEveryone } from '../../api/messages'
import { messageParts } from '../../lib/linkify'

/** Host de verdade do link (em punycode: "аpple.com" cirílico aparece xn--…). */
function hostOf(href: string): string {
  try {
    return new URL(href).host
  } catch {
    return href
  }
}

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
  // Quebra o texto só quando ele muda (hover e reações re-renderizam a linha).
  const parts = useMemo(() => messageParts(content, everyone), [content, everyone])
  return (
    <p className="cursor-text select-text whitespace-pre-wrap break-words text-ds-chat text-gray-200">
      {parts.map((part, i) =>
        part.href ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            title={hostOf(part.href)}
            // Isolado e sempre da esquerda para a direita: um U+202E antes do
            // link não inverte o endereço na tela.
            dir="ltr"
            style={{ unicodeBidi: 'isolate' }}
            className="text-link hover:underline"
          >
            {part.text}
          </a>
        ) : part.mention ? (
          <span key={i} className="rounded bg-brand/30 px-0.5 font-medium text-brand">
            {part.text}
          </span>
        ) : (
          part.text
        )
      )}
    </p>
  )
}

export default memo(MessageText)
