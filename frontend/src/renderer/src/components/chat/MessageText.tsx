import { memo, useMemo } from 'react'
import type { MentionEveryone } from '../../api/messages'
import { messageParts } from '../../lib/linkify'
import { mentionChipText, sameLabels, type MentionLabels } from '../../lib/mentions'
import MentionChip from './MentionChip'

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
 * O chip da menção mostra o nome da pessoa (`mentionLabels`), não o @nick; o
 * texto da mensagem continua "@nick".
 *
 * O link abre no navegador de fora: na web pelo target="_blank"; no app o
 * mesmo target cai no setWindowOpenHandler, que só deixa passar http/https.
 * Convite nosso é exceção: o clique abre a confirmação no app
 * (useInviteLinkClicks).
 */
function MessageText({
  content,
  everyone,
  mentionLabels
}: {
  content: string
  everyone: MentionEveryone | null
  mentionLabels?: MentionLabels
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
          <MentionChip
            key={i}
            mention={part.mention}
            displayText={mentionChipText(part, mentionLabels)}
          />
        ) : (
          part.text
        )
      )}
    </p>
  )
}

export default memo(
  MessageText,
  (a, b) =>
    a.content === b.content &&
    a.everyone === b.everyone &&
    sameLabels(a.mentionLabels, b.mentionLabels)
)
