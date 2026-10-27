import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CARD_BG,
  DEFAULT_PROFILE_THEME,
  PROFILE_BACKGROUNDS,
  PROFILE_BORDERS,
  PROFILE_EFFECTS,
  profileThemeLook,
  resolveProfileTheme,
  withBackground,
  withBorder
} from './profileTheme'

// Lê as listas e as contagens de cor do Go: mudou só de um lado, quebra aqui.
const goSrc = readFileSync(
  fileURLToPath(
    new URL('../../../../../../../backend/internal/profiletheme/profiletheme.go', import.meta.url)
  ),
  'utf8'
)
function goList(name: string): string[] {
  const body = new RegExp(`var ${name} = \\[\\]string\\{([^}]*)\\}`).exec(goSrc)?.[1] ?? ''
  return Array.from(body.matchAll(/"([a-z0-9]+)"/g), (m) => m[1])
}
function goCounts(name: string): Record<string, number> {
  const body = new RegExp(`var ${name} = map\\[string\\]int\\{([^}]*)\\}`).exec(goSrc)?.[1] ?? ''
  return Object.fromEntries(
    Array.from(body.matchAll(/"([a-z0-9]+)":\s*(\d+)/g), (m) => [m[1], Number(m[2])])
  )
}

describe('paridade com o backend', () => {
  it('bordas, fundos e efeitos são os mesmos', () => {
    expect(PROFILE_BORDERS.map((b) => b.id)).toEqual(goList('Borders'))
    expect(PROFILE_BACKGROUNDS.map((b) => b.id)).toEqual(goList('Backgrounds'))
    expect(PROFILE_EFFECTS.map((e) => e.id)).toEqual(goList('Effects'))
  })
  it('as contagens de cor são as mesmas', () => {
    expect(Object.fromEntries(PROFILE_BORDERS.map((b) => [b.id, b.colors]))).toEqual(
      goCounts('borderColors')
    )
    expect(Object.fromEntries(PROFILE_BACKGROUNDS.map((b) => [b.id, b.colors]))).toEqual(
      goCounts('backgroundColors')
    )
  })
})

describe('resolveProfileTheme', () => {
  it('ausente vira o padrão', () => {
    expect(resolveProfileTheme(undefined)).toEqual(DEFAULT_PROFILE_THEME)
    expect(resolveProfileTheme(null)).toEqual(DEFAULT_PROFILE_THEME)
  })
  it('mantém um tema válido (cores em minúsculas)', () => {
    expect(
      resolveProfileTheme({
        border: 'neon',
        border_colors: ['#00FFAA'],
        background: 'gradient',
        background_colors: ['#1E1B4B', '#0f172a'],
        effect: 'snow'
      })
    ).toEqual({
      border: 'neon',
      border_colors: ['#00ffaa'],
      background: 'gradient',
      background_colors: ['#1e1b4b', '#0f172a'],
      effect: 'snow'
    })
  })
  it('cada parte inválida cai no padrão sozinha', () => {
    const t = resolveProfileTheme({
      border: 'solid',
      border_colors: ['red;background:url(x)'],
      background: 'gradient',
      background_colors: ['#111111', '#222222'],
      effect: 'fogos'
    })
    expect(t.border).toBe('none')
    expect(t.border_colors).toEqual([])
    expect(t.background).toBe('gradient')
    expect(t.effect).toBe('none')
  })
  it('número errado de cores não vale', () => {
    expect(
      resolveProfileTheme({
        ...DEFAULT_PROFILE_THEME,
        background: 'gradient',
        background_colors: ['#111111']
      }).background
    ).toBe('default')
    expect(
      resolveProfileTheme({
        ...DEFAULT_PROFILE_THEME,
        border: 'rainbow',
        border_colors: ['#111111']
      }).border
    ).toBe('none')
  })
})

describe('withBorder / withBackground', () => {
  it('completa as cores que faltam e corta as que sobram', () => {
    const g = withBorder(DEFAULT_PROFILE_THEME, 'gradient')
    expect(g.border_colors).toHaveLength(2)
    const solid = withBorder(g, 'solid')
    expect(solid.border_colors).toEqual([g.border_colors[0]])
    expect(withBorder(solid, 'rainbow').border_colors).toEqual([])
    expect(withBackground(DEFAULT_PROFILE_THEME, 'gradient').background_colors).toHaveLength(2)
    expect(withBackground(DEFAULT_PROFILE_THEME, 'nope')).toBe(DEFAULT_PROFILE_THEME)
  })
})

describe('profileThemeLook', () => {
  it('padrão: fundo do app, sem classe de texto escuro', () => {
    const look = profileThemeLook(DEFAULT_PROFILE_THEME)
    expect(look.surface).toBe(CARD_BG)
    expect(look.ink).toBe('light')
    expect(look.className).toBe('profile-frame pt-border-none')
    expect(look.style).toMatchObject({ '--pt-bg': `linear-gradient(${CARD_BG}, ${CARD_BG})` })
  })
  it('degradê em pé com as duas cores e anel do avatar na de cima', () => {
    const look = profileThemeLook({
      ...DEFAULT_PROFILE_THEME,
      background: 'gradient',
      background_colors: ['#fce7f3', '#f9a8d4'],
      border: 'neon',
      border_colors: ['#ec4899']
    })
    expect(look.style).toMatchObject({
      '--pt-bg': 'linear-gradient(180deg, #fce7f3, #f9a8d4)',
      '--pt-b1': '#ec4899'
    })
    expect(look.surface).toBe('#fce7f3')
    expect(look.className).toContain('pt-border-neon')
    expect(look.className).toContain('pt-ink-dark')
  })
  it('fundo próprio escuro força o texto claro (vale em qualquer tema do app)', () => {
    const look = profileThemeLook({
      ...DEFAULT_PROFILE_THEME,
      background: 'solid',
      background_colors: ['#1e1b4b']
    })
    expect(look.ink).toBe('light')
    expect(look.className).toContain('pt-ink-light')
    expect(look.className).not.toContain('pt-ink-dark')
  })
})
