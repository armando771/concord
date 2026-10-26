import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NAME_STYLE,
  NAME_EFFECTS,
  NAME_FONTS,
  defaultColorsFor,
  nameStyleCss,
  resolveNameStyle
} from './nameStyle'

// Lê as listas de IDs do Go: se alguém adicionar uma fonte/efeito só de um lado, quebra aqui.
function goList(name: 'Fonts' | 'Effects'): string[] {
  const file = fileURLToPath(
    new URL('../../../../../backend/internal/namestyle/namestyle.go', import.meta.url)
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

describe('defaultColorsFor', () => {
  it('devolve o mínimo de cores que o efeito exige', () => {
    expect(defaultColorsFor('solid')).toEqual([])
    expect(defaultColorsFor('gradient')).toHaveLength(2)
    expect(defaultColorsFor('neon')).toHaveLength(1)
  })
})
