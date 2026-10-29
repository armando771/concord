// Cores do tema em vigor para o overlay nativo do Windows, que não lê CSS: o
// renderer principal resolve os tokens e manda em hex junto com o estado. A
// página do overlay do Electron ignora (ela usa os mesmos tokens direto).

export interface OverlayTheme {
  /** Fundo das pílulas (bg-floating). */
  floating: string
  /** Nome de quem fala (text-strong). */
  strong: string
  /** Nome dos outros e a dica da edição (text-gray-200 = text-normal). */
  normal: string
  /** Etiqueta "você" (text-gray-400 = text-muted). */
  muted: string
  /** Avatar sem foto e moldura da edição (brand). */
  brand: string
  /** Anel de quem fala (ring-success). */
  speaking: string
  /** Microfone/fone cortados (text-red-400). */
  danger: string
}

/** Token de assets/theme.css de cada cor (o mesmo que a página do overlay usa). */
export const OVERLAY_THEME_VARS: Record<keyof OverlayTheme, string> = {
  floating: '--bg-floating',
  strong: '--text-strong',
  normal: '--text-normal',
  muted: '--text-muted',
  brand: '--brand',
  speaking: '--green',
  danger: '--color-red-400'
}

const HEX = /^#[0-9a-f]{6}$/

/** Canais 0–255 → "#rrggbb". */
export function rgbToHex(r: number, g: number, b: number): string {
  const part = (v: number): string =>
    Math.min(255, Math.max(0, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/**
 * Lê os tokens e converte cada um para hex. Token que não resolve fica de
 * fora: o helper usa a cor do tema escuro padrão. Nenhum = null.
 */
export function readOverlayTheme(
  readVar: (name: string) => string,
  toHex: (cssColor: string) => string | null
): Partial<OverlayTheme> | null {
  const theme: Partial<OverlayTheme> = {}
  for (const key of Object.keys(OVERLAY_THEME_VARS) as (keyof OverlayTheme)[]) {
    const raw = readVar(OVERLAY_THEME_VARS[key]).trim()
    const hex = raw ? toHex(raw)?.toLowerCase() : null
    if (hex && HEX.test(hex)) theme[key] = hex
  }
  return Object.keys(theme).length > 0 ? theme : null
}
