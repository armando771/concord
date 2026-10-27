import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// No toque não existe hover, e `display: none` tira o botão do Tab: uma ação
// que só aparece com o mouse some para quem usa o app no celular ou pelo
// teclado. Este guarda reprova, em qualquer componente, um botão escondido de
// base (`hidden` ou `opacity-0` sem prefixo) que só volta com `group-hover`.
// O jeito certo é o prefixo do responsivo.md (`sm:opacity-0 sm:group-hover:…`) ou
// `[@media(hover:hover)]:…`, e `sr-only`/`focus-visible` para o teclado.

const SRC = fileURLToPath(new URL('../..', import.meta.url))

/** Só dicas e informação, sem ação escondida (ou a ação continua no toque por outro caminho). */
const INFORMATIVO = [
  'features/friends/components/PersonRow.tsx', // mostra o @ ao passar o mouse
  'features/levels/components/BadgeRow.tsx', // balão com o nome do badge
  'features/chat/components/MessageSticker.tsx', // balão com o nome da figurinha
  'features/chat/components/MessageParts.tsx', // hora da mensagem compacta
  'features/profile/components/ProfileCardBody.tsx', // botão invisível sobre o avatar/banner, que já abre ao toque
  'features/servers/components/VoiceKnockOverlay.tsx', // tocar no canal já pede para entrar
  'shared/ui/Avatar.tsx', // o GIF só anima no hover
  'app/UserBar.tsx' // troca o status pelo @ ao passar o mouse
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [full] : []
  })
}

/** Trechos entre aspas (className, template e ternários) de um arquivo. */
function literals(text: string): string[] {
  return Array.from(text.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g), (m) => m[2])
}

const GROUP_HOVER = /^group-hover(\/[\w-]+)?:/

/** O trecho tem uma ação escondida de base que só volta com o hover? */
export function hidesOnlyForHover(literal: string): boolean {
  // Aspas e chaves também separam: o trecho pode estar dentro de um ternário de template.
  const tokens = literal.split(/[\s'"`{}]+/)
  const revealed = tokens.some((t) => GROUP_HOVER.test(t))
  if (!revealed) return false
  const hiddenByDefault = tokens.includes('opacity-0') || tokens.includes('hidden')
  return hiddenByDefault
}

describe('hidesOnlyForHover (o detector)', () => {
  it('reprova escondido de base que só volta no hover', () => {
    expect(hidesOnlyForHover('hidden shrink-0 group-hover:block')).toBe(true)
    expect(hidesOnlyForHover('opacity-0 transition group-hover:opacity-100')).toBe(true)
    expect(hidesOnlyForHover('opacity-0 group-hover/tile:opacity-100 focus-within:opacity-100')).toBe(
      true
    )
  })

  it('enxerga o trecho dentro de um ternário de template', () => {
    expect(
      hidesOnlyForHover("flex ${onHover ? 'opacity-0 group-hover/voicech:opacity-100' : ''}")
    ).toBe(true)
  })

  it('aceita o que tem prefixo (breakpoint ou hover real) ou volta com o teclado sem esconder', () => {
    expect(hidesOnlyForHover('sm:opacity-0 sm:group-hover:opacity-100')).toBe(false)
    expect(
      hidesOnlyForHover('[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100')
    ).toBe(false)
    expect(
      hidesOnlyForHover('[@media(hover:hover)]:sr-only [@media(hover:hover)]:group-hover:not-sr-only')
    ).toBe(false)
    expect(hidesOnlyForHover('flex group-hover:text-strong')).toBe(false)
  })
})

describe('ações escondidas só no hover', () => {
  it('nenhum componente esconde uma ação sem alternativa para toque e teclado', () => {
    const offenders = sourceFiles(SRC)
      .map((file) => ({ rel: path.relative(SRC, file).replaceAll('\\', '/'), file }))
      .filter(({ rel }) => !INFORMATIVO.includes(rel))
      .filter(({ file }) => literals(readFileSync(file, 'utf8')).some(hidesOnlyForHover))
      .map(({ rel }) => rel)
    expect(offenders).toEqual([])
  })
})
