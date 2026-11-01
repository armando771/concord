import { colors } from '../../../shared/theme/tokens'
import { DARK_INK, LIGHT_INK, pickInk, type Ink } from './profileInk'
import { PRIDE_PALETTE, PRIDE_STRIPES } from './profilePride'
import { resolveProfileTheme, type ProfileTheme } from './profileTheme'

/**
 * Como o cartão aparece com o tema, em estilos do React Native. Por enquanto (PR 1) degradê, neon e
 * arco-íris viram a primeira cor; o desenho de verdade vem com o Skia no PR 2.
 */
export interface CardLook {
  borderWidth: number
  borderColor: string
  /** Fundo do corpo do cartão; também o recorte do avatar. */
  backgroundColor: string
  ink: Ink
  textColor: string
  mutedColor: string
}

function borderOf(theme: ProfileTheme): Pick<CardLook, 'borderWidth' | 'borderColor'> {
  if (theme.border === 'none') return { borderWidth: 0, borderColor: 'transparent' }
  const borderColor = theme.border === 'rainbow' ? PRIDE_STRIPES[0] : theme.border_colors[0]
  return { borderWidth: theme.border_width, borderColor }
}

/** Cores reais do fundo (no pride, as faixas escurecidas): o texto precisa vencer todas. */
function backgroundPalette(theme: ProfileTheme): string[] {
  return theme.background === 'pride' ? PRIDE_PALETTE : theme.background_colors
}

function inkOf(palette: string[]): Pick<CardLook, 'ink' | 'textColor' | 'mutedColor'> {
  if (palette.length === 0) return { ink: 'light', textColor: colors.textStrong, mutedColor: colors.textMuted }
  return pickInk(palette) === 'dark'
    ? { ink: 'dark', textColor: DARK_INK, mutedColor: 'rgba(30, 31, 34, 0.7)' }
    : { ink: 'light', textColor: LIGHT_INK, mutedColor: 'rgba(255, 255, 255, 0.7)' }
}

export function cardLook(raw: Partial<ProfileTheme> | null | undefined): CardLook {
  const theme = resolveProfileTheme(raw)
  const palette = backgroundPalette(theme)
  return { ...borderOf(theme), backgroundColor: palette[0] ?? colors.bgFloating, ...inkOf(palette) }
}
