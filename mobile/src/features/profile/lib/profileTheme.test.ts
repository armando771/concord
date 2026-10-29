import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_PROFILE_THEME,
  PROFILE_BACKGROUNDS,
  PROFILE_BORDERS,
  PROFILE_EFFECTS,
  effectDef,
  resolveProfileTheme,
  withBackground,
  withBorder
} from './profileTheme'
import { DEFAULT_EXTRAS, PROFILE_BORDER_ANIMATIONS, PROFILE_TEXTURES } from './profileThemeExtras'

// Lê as listas e as contagens de cor do Go: mudou só de um lado, quebra aqui.
const goFile = (name: string): string =>
  readFileSync(resolve(__dirname, `../../../../../backend/internal/profiletheme/${name}`), 'utf8')
const goSrc = goFile('profiletheme.go') + goFile('extras.go')
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
    expect(PROFILE_BORDER_ANIMATIONS.map((a) => a.id)).toEqual(goList('BorderAnimations'))
    expect(PROFILE_TEXTURES.map((t) => t.id)).toEqual(goList('Textures'))
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
      effect: 'snow',
      ...DEFAULT_EXTRAS
    })
  })
  it('tema salvo antes das opções novas: extras no padrão e o mesmo visual', () => {
    const old = {
      border: 'neon',
      border_colors: ['#ec4899'],
      background: 'gradient',
      background_colors: ['#fce7f3', '#f9a8d4'],
      effect: 'particles'
    }
    const t = resolveProfileTheme(old)
    expect(t).toEqual({ ...old, ...DEFAULT_EXTRAS })
  })
  it('efeitos novos valem', () => {
    for (const id of [
      'fire',
      'matrix',
      'glitch',
      'storm',
      'galaxy',
      'aurora',
      'hearts',
      'confetti',
      'synthwave',
      'rain'
    ]) {
      expect(resolveProfileTheme({ ...DEFAULT_PROFILE_THEME, effect: id }).effect).toBe(id)
    }
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

describe('effectDef', () => {
  it('effectDef: desconhecido vira Nenhum', () => {
    expect(effectDef('nope').id).toBe('none')
    expect(effectDef('glitch').color).toBeNull()
  })
})

describe('fundo pride', () => {
  const pride = { ...DEFAULT_PROFILE_THEME, background: 'pride' }
  it('não tem cor escolhível; cores soltas invalidam o fundo', () => {
    expect(resolveProfileTheme(pride).background).toBe('pride')
    expect(resolveProfileTheme({ ...pride, background_colors: ['#111111'] }).background).toBe(
      'default'
    )
    expect(withBackground(withBackground(DEFAULT_PROFILE_THEME, 'gradient'), 'pride')).toMatchObject(
      { background: 'pride', background_colors: [] }
    )
  })
})


describe('tema vindo do servidor (dado inválido)', () => {
  it('cor com nome não vale e a borda cai em nenhuma', () => {
    const t = resolveProfileTheme({ border: 'neon', border_colors: ['vermelho'] })
    expect(t.border).toBe('none')
    expect(t.border_colors).toEqual([])
  })
  it('cor curta (#fff) não vale', () => {
    expect(resolveProfileTheme({ background: 'solid', background_colors: ['#fff'] }).background).toBe('default')
  })
})
