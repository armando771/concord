import { resolveNameStyle, type NameStyle } from './nameStyle'

/**
 * Cor do nome no cartão: a primeira cor do estilo escolhido, ou a do texto do cartão quando o efeito
 * não tem cor própria (arco-íris, fogo) ou o estilo veio inválido. Os efeitos de verdade (degradê,
 * neon, glitch...) chegam com o Skia no PR 2.
 */
export function nameColorOf(style: Partial<NameStyle> | null | undefined, fallback: string): string {
  return resolveNameStyle(style).colors[0] ?? fallback
}
