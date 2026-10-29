// Tokens do tema Discord Escuro da Salinha, espelho de
// frontend/src/renderer/src/assets/theme.css. Use sempre estes, nunca hex solto.

export const colors = {
  bgApp: '#121214',
  bgTertiary: '#121214',
  bgSecondary: '#121214',
  bgPrimary: '#1a1a1e',
  bgMembers: '#222327',
  bgSurface: '#242429',
  bgFloating: '#252429',
  bgInput: '#222327',
  bgAccent: '#323237',
  borderSubtle: 'rgba(151, 151, 159, 0.122)',
  borderNormal: 'rgba(151, 151, 159, 0.2)',
  borderStrong: 'rgba(151, 151, 159, 0.439)',
  textStrong: '#fbfbfb',
  textNormal: '#efeff1',
  textSecondary: '#abacb2',
  textMuted: '#96979e',
  textFaint: '#8a8b92',
  textLink: '#4d96ee',
  textBrand: '#94a8ff',
  textPositive: '#5eb479',
  textDanger: '#ffa09b',
  textWarning: '#fcb529',
  interactiveNormal: '#96979e',
  interactiveMuted: '#4e5058',
  brand: '#5865f2',
  brandHover: '#4752c4',
  green: '#45a366',
  greenStrong: '#248046',
  red: '#da3e44',
  redStrong: '#da373c',
  yellow: '#f0b232',
  white: '#ffffff'
} as const

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

export const radius = { sm: 4, md: 8, lg: 12, pill: 999 } as const

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 } as const

/** Alvo mínimo de toque (dp): 44 é o piso de acessibilidade do app. */
export const MIN_TOUCH = 44

/** Largura máxima do conteúdo: telas de formulário centralizam acima disso (tablet). */
export const MAX_CONTENT_WIDTH = 768
