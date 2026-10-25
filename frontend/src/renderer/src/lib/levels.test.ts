import { describe, expect, it } from 'vitest'
import {
  formatVoiceTime,
  isMilestone,
  LEGENDARY_TIER,
  levelPercent,
  levelTier,
  levelUpEffects,
  minutesToNext,
  sparkCount
} from './levels'

describe('levelTier', () => {
  it('muda de faixa a cada 10 níveis', () => {
    expect(levelTier(1).name).toBe('Bronze')
    expect(levelTier(9).name).toBe('Bronze')
    expect(levelTier(10).name).toBe('Prata')
    expect(levelTier(25).name).toBe('Ouro')
    expect(levelTier(99).name).toBe('Celestial')
  })

  it('do 100 em diante é lendário, sem limite', () => {
    expect(levelTier(100)).toBe(LEGENDARY_TIER)
    expect(levelTier(4321)).toBe(LEGENDARY_TIER)
  })
})

describe('animação', () => {
  it('marcos são os níveis redondos', () => {
    expect(isMilestone(10)).toBe(true)
    expect(isMilestone(100)).toBe(true)
    expect(isMilestone(11)).toBe(false)
  })

  it('mais faíscas conforme sobe, com teto', () => {
    expect(sparkCount(2)).toBe(8)
    expect(sparkCount(15)).toBeGreaterThan(sparkCount(5))
    expect(sparkCount(20)).toBeGreaterThan(sparkCount(21))
    expect(sparkCount(999)).toBe(24)
  })
})

describe('progresso', () => {
  it('percentual e minutos restantes', () => {
    expect(levelPercent(77, 155)).toBe(49)
    expect(levelPercent(0, 0)).toBe(0)
    expect(minutesToNext(150, 155)).toBe(1)
    expect(minutesToNext(0, 155)).toBe(16)
  })

  it('formata o tempo de voz', () => {
    expect(formatVoiceTime(45 * 60)).toBe('45 min')
    expect(formatVoiceTime(200 * 60)).toBe('3 h 20 min')
    expect(formatVoiceTime(12 * 3600)).toBe('12 h')
  })
})

describe('levelUpEffects (escada da animação)', () => {
  const BRACKETS = [5, 25, 45, 65, 85, 100]
  const particles = (level: number): number => {
    const e = levelUpEffects(level)
    return e.sparks + e.orbit + e.confetti + e.stars
  }

  it('1–19: halo, faíscas e faixa, como era', () => {
    const e = levelUpEffects(5)
    expect(e.stage).toBe(0)
    expect(e.sparks).toBe(sparkCount(5))
    expect(e.rays).toBe(false)
    expect(e.rollNumber).toBe(false)
    expect(e.orbit).toBe(0)
    expect(e.chime).toBeNull()
    expect(e.durationMs).toBe(3200)
  })

  it('20–39: raios atrás do avatar, número rolando e faixa um pouco mais longa', () => {
    const e = levelUpEffects(25)
    expect(e.stage).toBe(1)
    expect(e.rays).toBe(true)
    expect(e.rollNumber).toBe(true)
    expect(e.orbit).toBe(0)
    expect(e.bannerBorder).toBe(false)
    expect(e.durationMs).toBeGreaterThan(levelUpEffects(5).durationMs)
  })

  it('40–59: partículas em órbita, borda animada e um chime curto', () => {
    const e = levelUpEffects(45)
    expect(e.stage).toBe(2)
    expect(e.orbit).toBeGreaterThan(0)
    expect(e.bannerBorder).toBe(true)
    expect(e.chime).toBe('levelChime')
    expect(e.confetti).toBe(0)
  })

  it('60–79: confete, tile brilhando e burst maior para os outros', () => {
    const e = levelUpEffects(65)
    expect(e.stage).toBe(3)
    expect(e.confetti).toBeGreaterThan(0)
    expect(e.tileGlow).toBe(true)
    expect(e.burstScale).toBeGreaterThan(levelUpEffects(45).burstScale)
    expect(e.vignette).toBe(false)
  })

  it('80–99: vinheta na janela, emblema da faixa e chime mais rico', () => {
    const e = levelUpEffects(85)
    expect(e.stage).toBe(4)
    expect(e.vignette).toBe(true)
    expect(e.emblem).toBe(true)
    expect(e.chime).toBe('levelChimeRich')
    expect(e.legendary).toBe(false)
  })

  it('100+: celebração lendária com estrelas caindo e fanfarra', () => {
    for (const level of [100, 101, 250]) {
      const e = levelUpEffects(level)
      expect(e.stage).toBe(5)
      expect(e.legendary).toBe(true)
      expect(e.stars).toBeGreaterThan(0)
      expect(e.chime).toBe('levelFanfare')
      expect(e.durationMs).toBeGreaterThanOrEqual(4000)
    }
  })

  it('cada degrau soma ao anterior e nada encolhe', () => {
    for (let i = 1; i < BRACKETS.length; i++) {
      const prev = levelUpEffects(BRACKETS[i - 1])
      const cur = levelUpEffects(BRACKETS[i])
      expect(cur.stage).toBe(prev.stage + 1)
      expect(cur.durationMs).toBeGreaterThan(prev.durationMs)
      expect(cur.burstScale).toBeGreaterThanOrEqual(prev.burstScale)
      expect(cur.sparks).toBeGreaterThanOrEqual(prev.sparks)
      for (const flag of [
        'rays',
        'rollNumber',
        'bannerBorder',
        'tileGlow',
        'vignette',
        'emblem'
      ] as const) {
        if (prev[flag]) expect(cur[flag]).toBe(true)
      }
      if (prev.chime) expect(cur.chime).not.toBeNull()
    }
  })

  it('marcos: onda de choque e "Nova faixa" com o nome da faixa nova', () => {
    for (let level = 10; level <= 100; level += 10) {
      const e = levelUpEffects(level)
      expect(e.shockwave).toBe(true)
      expect(e.tierReveal).toBe(levelTier(level).name)
    }
    expect(levelUpEffects(100).tierReveal).toBe('Lendário')
    expect(levelUpEffects(31).tierReveal).toBeNull()
    expect(levelUpEffects(31).shockwave).toBe(false)
  })

  it('marco do marco: os efeitos do próprio nível continuam', () => {
    const e = levelUpEffects(60)
    expect(e.confetti).toBeGreaterThan(0)
    expect(e.orbit).toBeGreaterThan(0)
    expect(e.tierReveal).toBe('Rubi')
  })

  it('sem faixa nova não tem revelação (110 continua Lendário)', () => {
    expect(levelUpEffects(110).shockwave).toBe(true)
    expect(levelUpEffects(110).tierReveal).toBeNull()
  })

  it('pulou vários níveis e cruzou a faixa: revela mesmo fora do redondo', () => {
    expect(levelUpEffects(21, 18).tierReveal).toBe('Ouro')
    expect(levelUpEffects(21, 20).tierReveal).toBeNull()
  })

  it('no máximo ~60 partículas animadas, em qualquer nível', () => {
    for (let level = 1; level <= 300; level++) expect(particles(level)).toBeLessThanOrEqual(60)
    expect(particles(100)).toBeGreaterThan(particles(85))
  })
})
