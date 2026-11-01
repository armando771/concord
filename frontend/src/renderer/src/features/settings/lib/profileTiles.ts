import { NAME_EFFECTS, NAME_FONTS, type NameStyle } from '../../profile/lib/nameStyle'
import { PROFILE_PRESETS } from '../../profile/lib/profilePresets'
import { sameTheme, type ProfileTheme } from '../../profile/lib/profileTheme'

// O resumo que cada bloco da coluna de personalização mostra (Configurações
// → Perfis): o nome do tema, o estilo do nome, quantos links...

/** Nome da predefinição do tema, ou "Personalizado" quando foi ajustado. */
export function themeName(theme: ProfileTheme): string {
  return PROFILE_PRESETS.find((p) => sameTheme(p.theme, theme))?.label ?? 'Personalizado'
}

/** "Fonte · Efeito" do nome de exibição. */
export function nameStyleSummary(style: NameStyle): string {
  const font = NAME_FONTS.find((f) => f.id === style.font) ?? NAME_FONTS[0]
  const effect = NAME_EFFECTS.find((e) => e.id === style.effect) ?? NAME_EFFECTS[0]
  return `${font.label} · ${effect.label}`
}

/** O texto como aparece no bloco, ou null quando está vazio (o bloco convida). */
export function textSummary(value: string | undefined): string | null {
  return value?.trim() || null
}

export function linksSummary(links: string[]): string | null {
  if (links.length === 0) return null
  return links.length === 1 ? '1 link' : `${links.length} links`
}

export function soundSummary(url: string | null): string {
  return url ? 'Som personalizado' : 'Som padrão'
}

/** A linha de situação embaixo do cartão enquanto uma mudança vai para o servidor. */
export function savingLabel(saving: boolean, progress: number | null): string | null {
  if (!saving) return null
  return progress !== null ? `Enviando a imagem: ${Math.round(progress * 100)}%` : 'Salvando…'
}
