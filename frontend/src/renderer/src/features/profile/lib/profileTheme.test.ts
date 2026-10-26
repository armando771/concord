import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CARD_BG,
  DARK_INK,
  DEFAULT_PROFILE_THEME,
  LIGHT_INK,
  PROFILE_BACKGROUNDS,
  PROFILE_BORDERS,
  PROFILE_EFFECTS,
  PROFILE_PRESETS,
  contrastRatio,
  effectParticles,
  pickInk,
  profileThemeLook,
  relativeLuminance,
  resolveProfileTheme,
  sameTheme,
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

describe('contraste', () => {
  it('luminância e razão batem com a WCAG', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
  })
  it('fundo escuro ou saturado escuro → texto claro', () => {
    expect(pickInk(['#111214'])).toBe('light')
    // O fundo padrão vem do tema (var()), não dá para medir: fica o texto do app.
    expect(pickInk([CARD_BG])).toBe('light')
    expect(pickInk(['#1e1b4b', '#0b1020'])).toBe('light')
    expect(pickInk(['#6b1d12', '#4b4f58'])).toBe('light')
    expect(pickInk(['#5865f2'])).toBe('light')
  })
  it('fundo claro → texto escuro', () => {
    expect(pickInk(['#ffffff'])).toBe('dark')
    expect(pickInk(['#fce7f3', '#f9a8d4'])).toBe('dark')
    expect(pickInk(['#fde047'])).toBe('dark')
    expect(pickInk(['#22d3ee'])).toBe('dark')
  })
  it('no degradê vale o pior ponto', () => {
    // Do branco ao preto nenhum texto vai bem nas duas pontas: fica o que
    // perde menos no pior ponto (pontas e meio).
    const points = ['#ffffff', '#000000', '#808080']
    const worst = (c: string): number => Math.min(...points.map((p) => contrastRatio(c, p)))
    const ink = pickInk(['#ffffff', '#000000'])
    const [chosen, other] = ink === 'dark' ? [DARK_INK, LIGHT_INK] : [LIGHT_INK, DARK_INK]
    expect(worst(chosen)).toBeGreaterThanOrEqual(worst(other))
    // Claro em cima, médio embaixo: o escuro ainda ganha.
    expect(pickInk(['#e0f2fe', '#7dd3fc'])).toBe('dark')
  })
  it('sempre escolhe o de maior contraste mínimo (varredura)', () => {
    for (let v = 0; v <= 255; v += 5) {
      const hex = `#${v.toString(16).padStart(2, '0').repeat(3)}`
      const ink = pickInk([hex])
      const chosen = contrastRatio(ink === 'dark' ? DARK_INK : LIGHT_INK, hex)
      const other = contrastRatio(ink === 'dark' ? LIGHT_INK : DARK_INK, hex)
      expect(chosen).toBeGreaterThanOrEqual(other)
      // Com uma cor só, o melhor dos dois textos nunca fica abaixo de 4:1.
      expect(chosen).toBeGreaterThanOrEqual(4)
    }
  })
  it('cor inválida é ignorada', () => {
    expect(pickInk(['nope'])).toBe('light')
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

describe('effectParticles', () => {
  it('determinístico e dentro do cartão', () => {
    for (const e of ['particles', 'sparkles', 'snow']) {
      const a = effectParticles(e)
      expect(a.length).toBeGreaterThan(0)
      expect(effectParticles(e)).toEqual(a)
      for (const p of a) {
        expect(p.left).toBeGreaterThanOrEqual(0)
        expect(p.left).toBeLessThanOrEqual(100)
        expect(p.top).toBeGreaterThanOrEqual(0)
        expect(p.top).toBeLessThanOrEqual(100)
      }
    }
    expect(effectParticles('none')).toEqual([])
  })
})

describe('predefinições', () => {
  it('todas são temas válidos', () => {
    for (const p of PROFILE_PRESETS) {
      expect(sameTheme(resolveProfileTheme(p.theme), p.theme), p.id).toBe(true)
      expect(resolveProfileTheme(p.theme), p.id).toEqual(p.theme)
    }
  })
})
