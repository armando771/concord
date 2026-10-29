import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_NAME_STYLE,
  NAME_EFFECTS,
  NAME_FONTS,
  resolveNameStyle
} from './nameStyle'

// Lê as listas de IDs do Go: se alguém adicionar uma fonte/efeito só de um lado, quebra aqui.
function goList(name: 'Fonts' | 'Effects'): string[] {
  const file = resolve(__dirname, '../../../../../backend/internal/namestyle/namestyle.go')
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
      expect(def).toBeDefined()
      expect([def!.minColors, def!.maxColors]).toEqual([min, max])
    }
  })
})

describe('estilo vindo do servidor (dado inválido)', () => {
  it('cor curta (#fff) não vale e o degradê volta para sólido', () => {
    expect(resolveNameStyle({ font: 'default', effect: 'gradient', colors: ['#fff', '#000'] })).toEqual({
      font: 'default',
      effect: 'solid',
      colors: []
    })
  })
  it('nulo e indefinido viram o padrão', () => {
    expect(resolveNameStyle(null)).toEqual(DEFAULT_NAME_STYLE)
  })
})
