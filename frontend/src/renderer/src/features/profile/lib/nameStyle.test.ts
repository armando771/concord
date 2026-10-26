import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NAME_STYLE,
  NAME_EFFECTS,
  NAME_FONTS,
  defaultColorsFor,
  nameEndPadding,
  nameGraphemes,
  nameStyleCss,
  resolveNameStyle,
  type NameStyle
} from './nameStyle'

// Lê as listas de IDs do Go: se alguém adicionar uma fonte/efeito só de um lado, quebra aqui.
function goList(name: 'Fonts' | 'Effects'): string[] {
  const file = fileURLToPath(
    new URL('../../../../../../../backend/internal/namestyle/namestyle.go', import.meta.url)
  )
  const src = readFileSync(file, 'utf8')
  const body = new RegExp(`var ${name} = \\[\\]string\\{([^}]*)\\}`).exec(src)?.[1] ?? ''
  return Array.from(body.matchAll(/"([a-z0-9]+)"/g), (m) => m[1])
}

describe('paridade com o backend', () => {
  it('as fontes são as mesmas', () => {
    expect(NAME_FONTS.map((f) => f.id)).toEqual(goList('Fonts'))
  })
  it('os efeitos são os mesmos', () => {
    expect(NAME_EFFECTS.map((e) => e.id)).toEqual(goList('Effects'))
  })
})

describe('resolveNameStyle', () => {
  it('vazio ou ausente vira o padrão', () => {
    expect(resolveNameStyle(undefined)).toEqual(DEFAULT_NAME_STYLE)
    expect(resolveNameStyle({ font: '', effect: '', colors: null as never })).toEqual(
      DEFAULT_NAME_STYLE
    )
  })
  it('ID desconhecido cai no padrão e mantém o que é válido', () => {
    expect(resolveNameStyle({ font: 'nope', effect: 'neon', colors: ['#00ffaa'] })).toEqual({
      font: 'default',
      effect: 'neon',
      colors: ['#00ffaa']
    })
  })
  it('descarta cor inválida (nunca vira CSS)', () => {
    const s = resolveNameStyle({ font: 'tempo', effect: 'solid', colors: ['red;x:y', '#abc'] })
    expect(s.colors).toEqual([])
  })
  it('efeito que exige cores sem elas volta para sólido', () => {
    expect(
      resolveNameStyle({ font: 'tempo', effect: 'gradient', colors: ['#ff0000'] }).effect
    ).toBe('solid')
  })
})

describe('nameStyleCss', () => {
  it('padrão não muda nada', () => {
    expect(nameStyleCss(DEFAULT_NAME_STYLE)).toEqual({ className: '', style: {} })
  })
  it('fonte entra como font-family', () => {
    const { style } = nameStyleCss({ font: 'bit8', effect: 'solid', colors: [] })
    expect(style.fontFamily).toContain('Press Start 2P')
  })
  it('degradê usa as duas cores e recorta no texto', () => {
    const { style } = nameStyleCss({
      font: 'default',
      effect: 'gradient',
      colors: ['#ff0000', '#0000ff']
    })
    expect(style.backgroundImage).toContain('#ff0000')
    expect(style.backgroundImage).toContain('#0000ff')
    expect(style.WebkitBackgroundClip).toBe('text')
  })
  it('neon usa text-shadow com a cor', () => {
    const { style } = nameStyleCss({ font: 'default', effect: 'neon', colors: ['#00ffaa'] })
    expect(String(style.textShadow)).toContain('#00ffaa')
  })
  it('toon tem contorno claro (legível no tema escuro)', () => {
    const { style } = nameStyleCss({ font: 'default', effect: 'toon', colors: ['#00ffaa'] })
    expect(style.color).toBe('#00ffaa')
    expect(String(style.textShadow)).toContain('#fff')
  })
  it('arco-íris e pulso usam classe (animação)', () => {
    expect(nameStyleCss({ font: 'default', effect: 'rainbow', colors: [] }).className).toBe(
      'name-rainbow'
    )
    expect(nameStyleCss({ font: 'default', effect: 'pulse', colors: ['#ff00ff'] }).className).toBe(
      'name-pulse'
    )
  })
})

describe('efeitos novos', () => {
  it('têm cores iguais às do backend (mínimo e máximo)', () => {
    // Espelha namestyle.go: minColors/colorLimit.
    const expected: Record<string, [number, number]> = {
      flow: [2, 2],
      glow: [1, 1],
      glitch: [0, 1],
      fire: [0, 0],
      wave: [0, 1],
      shimmer: [0, 1],
      sparkle: [0, 1],
      typewriter: [0, 1],
      chrome: [0, 0],
      shadow3d: [2, 2]
    }
    for (const [id, [min, max]] of Object.entries(expected)) {
      const def = NAME_EFFECTS.find((e) => e.id === id)
      expect(def, id).toBeDefined()
      expect([def!.minColors, def!.maxColors], id).toEqual([min, max])
    }
  })
  it('degradê animado usa as duas cores e a classe animada', () => {
    const css = nameStyleCss({ font: 'default', effect: 'flow', colors: ['#ff0000', '#0000ff'] })
    expect(css.className).toBe('name-flow')
    expect(css.style.backgroundImage).toContain('#ff0000')
    expect(css.style.backgroundImage).toContain('#0000ff')
  })
  it('glitch e neon pulsante desenham uma cópia do texto (data-text)', () => {
    expect(nameStyleCss({ font: 'default', effect: 'glitch', colors: [] }).copy).toBe(true)
    const glow = nameStyleCss({ font: 'default', effect: 'glow', colors: ['#00ffaa'] })
    expect(glow.copy).toBe(true)
    expect(glow.style).toMatchObject({ '--name-c1': '#00ffaa' })
  })
  it('onda separa as letras', () => {
    expect(nameStyleCss({ font: 'default', effect: 'wave', colors: [] }).letters).toBe(true)
    expect(nameStyleCss({ font: 'default', effect: 'fire', colors: [] }).letters).toBeFalsy()
  })
  it('sombra 3D empilha sombras na segunda cor', () => {
    const { style } = nameStyleCss({
      font: 'default',
      effect: 'shadow3d',
      colors: ['#ffffff', '#ff00aa']
    })
    expect(style.color).toBe('#ffffff')
    expect(String(style.textShadow).match(/#ff00aa/g)?.length).toBeGreaterThanOrEqual(3)
  })
  it('fogo e cromado não aceitam cor', () => {
    expect(resolveNameStyle({ font: 'default', effect: 'fire', colors: ['#ff0000'] })).toEqual({
      font: 'default',
      effect: 'fire',
      colors: []
    })
    expect(nameStyleCss({ font: 'default', effect: 'chrome', colors: [] }).className).toBe(
      'name-chrome'
    )
  })
  it('fontes novas viram font-family', () => {
    expect(nameStyleCss({ font: 'pixel', effect: 'solid', colors: [] }).style.fontFamily).toContain(
      'Silkscreen'
    )
    expect(
      nameStyleCss({ font: 'gothic', effect: 'solid', colors: [] }).style.fontFamily
    ).toContain('UnifrakturMaguntia')
  })
})

describe('nameEndPadding', () => {
  const style = (font: string, effect: string, colors: string[] = []): NameStyle =>
    resolveNameStyle({ font, effect, colors })

  it('nome padrão não ganha espaço (nada muda)', () => {
    expect(nameEndPadding(style('default', 'solid'))).toEqual({})
    expect(nameEndPadding(style('default', 'rainbow'))).toEqual({})
  })

  it('fonte própria ganha espaço no fim: o traço da última letra passa da caixa e o overflow do truncate cortava', () => {
    expect(nameEndPadding(style('elegant', 'solid'))).toEqual({ paddingInlineEnd: '0.2em' })
    expect(nameEndPadding(style('gothic', 'gradient', ['#4dc3ff', '#b84dff']))).toEqual({
      paddingInlineEnd: '0.2em'
    })
  })

  it('sombra deslocada para a direita também precisa de espaço', () => {
    expect(nameEndPadding(style('default', 'pop', ['#ff00ff']))).toEqual({
      paddingInlineEnd: '0.2em'
    })
    expect(nameEndPadding(style('default', 'shadow3d', ['#ffffff', '#ff00ff']))).toEqual({
      paddingInlineEnd: '0.2em'
    })
  })
})

describe('nameGraphemes', () => {
  it('não quebra emoji nem acento combinado', () => {
    expect(nameGraphemes('oi👍🏽')).toEqual(['o', 'i', '👍🏽'])
    expect(nameGraphemes('e\u0301a')).toEqual(['e\u0301', 'a'])
  })
})

describe('defaultColorsFor', () => {
  it('devolve o mínimo de cores que o efeito exige', () => {
    expect(defaultColorsFor('solid')).toEqual([])
    expect(defaultColorsFor('gradient')).toHaveLength(2)
    expect(defaultColorsFor('neon')).toHaveLength(1)
  })
})
