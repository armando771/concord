import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../../shared/lib/contrast'
import { levelUpEffects } from '../../levels/lib/levels'
import { rollNumbers, serverLevelBadge, serverLevelScene, SERVER_BANDS } from './serverLevelScene'

/** Tudo o que a subida de nível de uma pessoa desenha no máximo. */
const userParticles = (level: number): number => {
  const fx = levelUpEffects(level)
  return fx.sparks + fx.orbit + fx.confetti + fx.stars + fx.milestoneParticles
}

describe('serverLevelScene', () => {
  it('escolhe a faixa pelo nível', () => {
    const band = (level: number): string => serverLevelScene(level).band
    expect([1, 2, 4].map(band)).toEqual(['base', 'base', 'base'])
    expect([5, 9].map(band)).toEqual(['fogos', 'fogos'])
    expect([11, 19].map(band)).toEqual(['tempestade', 'tempestade'])
    expect([21, 29].map(band)).toEqual(['cosmica', 'cosmica'])
    expect([31, 99, 1000].map(band)).toEqual(['lendaria', 'lendaria', 'lendaria'])
  })

  it('cada faixa acrescenta efeitos e fica mais insana que a anterior', () => {
    const scenes = [2, 6, 12, 22, 33].map(serverLevelScene)
    expect(scenes.map((s) => s.band)).toEqual(SERVER_BANDS)
    for (let i = 1; i < scenes.length; i++) {
      const [a, b] = [scenes[i - 1], scenes[i]]
      expect(b.particles, b.band).toBeGreaterThan(a.particles)
      expect(b.durationMs, b.band).toBeGreaterThanOrEqual(a.durationMs)
      expect(b.shake, b.band).toBeGreaterThanOrEqual(a.shake)
      for (const [layer, on] of Object.entries(a.layers))
        if (on) expect(b.layers[layer as never]).toBe(true)
    }
    expect(scenes[0].layers).toEqual({
      fireworks: false,
      lightning: false,
      galaxy: false,
      aurora: false
    })
    expect(scenes[1].layers.fireworks).toBe(true)
    expect(scenes[2].layers.lightning).toBe(true)
    expect(scenes[2].shake).toBeGreaterThan(0)
    expect(scenes[3].layers.galaxy).toBe(true)
    expect(scenes[4].layers.aurora).toBe(true)
    expect(scenes[4].rings).toBeGreaterThan(1)
  })

  it('marcos redondos têm cena exclusiva', () => {
    expect(serverLevelScene(10).milestone).toBe('coroa')
    expect(serverLevelScene(25).milestone).toBe('supernova')
    expect(serverLevelScene(50).milestone).toBe('eclipse')
    expect(serverLevelScene(100).milestone).toBe('bigbang')
    expect(serverLevelScene(75).milestone).toBe('supernova')
    expect(serverLevelScene(150).milestone).toBe('eclipse')
    expect(serverLevelScene(200).milestone).toBe('bigbang')
    for (const level of [1, 9, 11, 20, 24, 30, 40, 99]) {
      expect(serverLevelScene(level).milestone, `nível ${level}`).toBeNull()
    }
    // O marco é mais forte que a faixa dele.
    expect(serverLevelScene(25).particles).toBeGreaterThan(serverLevelScene(24).particles)
    expect(serverLevelScene(10).title).toBe('Coroa de raios')
  })

  it('dura entre 3 e 5 segundos', () => {
    for (const level of [1, 5, 10, 25, 50, 100, 500]) {
      const { durationMs } = serverLevelScene(level)
      expect(durationMs).toBeGreaterThanOrEqual(3000)
      expect(durationMs).toBeLessThanOrEqual(5000)
    }
  })

  it('é sempre mais épica que a subida de nível de uma pessoa no mesmo nível', () => {
    for (let level = 1; level <= 150; level++) {
      expect(serverLevelScene(level).particles, `nível ${level}`).toBeGreaterThan(
        userParticles(level)
      )
    }
  })

  it('nível torto vira o nível 1', () => {
    expect(serverLevelScene(Number.NaN).band).toBe('base')
    expect(serverLevelScene(-4).milestone).toBeNull()
  })
})

describe('serverLevelBadge (selo "Nv. N" do servidor)', () => {
  it('muda de material por faixa', () => {
    expect([1, 5, 10, 20, 30, 300].map((l) => serverLevelBadge(l).name)).toEqual([
      'Bronze',
      'Prata',
      'Ouro',
      'Cristal',
      'Lendário',
      'Lendário'
    ])
  })

  it('o texto passa no AA em todas as faixas', () => {
    for (const level of [1, 5, 10, 20, 30]) {
      const look = serverLevelBadge(level)
      for (const bg of look.surface) {
        expect(contrastRatio(look.text, bg), `${look.name} sobre ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('contagem da subida', () => {
  it('rollNumbers conta do anterior até o novo (no máximo os últimos 12)', () => {
    expect(rollNumbers(4, 6)).toEqual([4, 5, 6])
    expect(rollNumbers(1, 30)).toEqual([18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30])
    expect(rollNumbers(7, 7)).toEqual([7])
    expect(rollNumbers(9, 7)).toEqual([7])
  })
})
