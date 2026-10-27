// Caracteres permitidos em nomes que os outros veem (nome de exibição e
// apelido no servidor). Espelho de backend/internal/user/name.go: o app avisa
// antes, o servidor recusa de verdade.

const ZWJ = 0x200d
const VS16 = 0xfe0f
const REPLACEMENT = 0xfffd

/** Letras e símbolos que aparecem em branco. */
const INVISIBLE = new Set([0x034f, 0x115f, 0x1160, 0x17b4, 0x17b5, 0x2800, 0x3164, 0xffa0])

const CONTROL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u
const EMOJI_PART = /[\p{So}\p{Sk}]/u
const SYMBOL = /\p{So}/u
const VS16_BASE = /[\p{So}\p{Sm}\p{Sk}\p{Nd}\p{P}]/u
const VISIBLE = /[\p{L}\p{N}\p{P}\p{S}]/u

/** ZWJ só vale entre emoji (ou VS16) e um símbolo. */
function zwjValid(prev: string | undefined, next: string | undefined): boolean {
  const prevOk = prev !== undefined && (EMOJI_PART.test(prev) || prev.codePointAt(0) === VS16)
  return prevOk && next !== undefined && SYMBOL.test(next)
}

/** VS16 só vale depois de símbolo, dígito ou pontuação. */
function vs16Valid(prev: string | undefined): boolean {
  return prev !== undefined && VS16_BASE.test(prev)
}

function isForbidden(ch: string, code: number): boolean {
  return code === REPLACEMENT || INVISIBLE.has(code) || CONTROL.test(ch)
}

/**
 * Problema nos caracteres de um nome já sem espaços nas pontas: "invalid"
 * (controle, NUL, invisível, bidi), "blank" (nada visível) ou null (ok). O ZWJ
 * só vale entre emoji e o VS16 só depois de símbolo, dígito ou pontuação.
 */
export function nameCharsError(name: string): 'invalid' | 'blank' | null {
  const chars = Array.from(name)
  let visible = false
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const code = ch.codePointAt(0) ?? 0
    if (code === ZWJ) {
      if (!zwjValid(chars[i - 1], chars[i + 1])) return 'invalid'
    } else if (code === VS16) {
      if (!vs16Valid(chars[i - 1])) return 'invalid'
    } else if (isForbidden(ch, code)) {
      return 'invalid'
    } else if (VISIBLE.test(ch)) {
      visible = true
    }
  }
  return visible ? null : 'blank'
}

/** Mensagem do problema (o nome do campo vem de quem chama). */
export const NAME_CHARS_MESSAGE = 'Sem caracteres invisíveis ou de controle.'
