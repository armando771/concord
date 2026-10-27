import { describe, expect, it } from 'vitest'
import type { Badge, BadgeUnlockEvent } from '../api/badges'
import {
  badgeLabel,
  formatThreshold,
  formatUnlockDate,
  holoPointer,
  isMythic,
  profileBadgeRow,
  progressPercent,
  publicStatText,
  RARITY,
  remainingText,
  splitBadges,
  statText,
  unlockCount,
  selectedBadge,
  unlocksComAviso,
  visibleBadges
} from './badges'

const HOUR = 3600

function badge(over: Partial<Badge> = {}): Badge {
  return {
    category: 'voz',
    name: 'Tempo em call',
    description: '',
    unit: 'seconds',
    value: 0,
    tier: 0,
    progress: 0,
    obtainable: true,
    tiers: [],
    ...over
  }
}

describe('statText', () => {
  it('fala o número de cada categoria em português', () => {
    expect(statText(badge({ value: 798 * HOUR }))).toBe('798 horas em call')
    expect(statText(badge({ value: HOUR }))).toBe('1 hora em call')
    expect(statText(badge({ value: 45 * 60 }))).toBe('45 min em call')
    expect(statText(badge({ category: 'streamer', value: 12 * HOUR }))).toBe(
      '12 horas transmitindo'
    )
    expect(statText(badge({ category: 'espectador', value: 3 * HOUR }))).toBe(
      '3 horas assistindo lives'
    )
    expect(statText(badge({ category: 'coruja', value: 3 * HOUR }))).toBe(
      '3 horas em call de madrugada'
    )
    expect(statText(badge({ category: 'maratona', value: 5 * HOUR }))).toBe(
      '5 horas seguidas numa call'
    )
    expect(statText(badge({ category: 'mensagens', unit: 'messages', value: 12345 }))).toBe(
      '12.345 mensagens enviadas'
    )
    expect(statText(badge({ category: 'mensagens', unit: 'messages', value: 1 }))).toBe(
      '1 mensagem enviada'
    )
    expect(statText(badge({ category: 'nivel', unit: 'level', value: 27 }))).toBe('Nível 27')
    expect(statText(badge({ category: 'festeiro', unit: 'people', value: 7 }))).toBe(
      'Call com até 7 pessoas'
    )
    expect(statText(badge({ category: 'dono', unit: 'servers', value: 1 }))).toBe(
      'Dono de 1 servidor'
    )
    expect(statText(badge({ category: 'reacoes', unit: 'reactions', value: 2 }))).toBe('2 reações')
    expect(statText(badge({ category: 'fundador', unit: 'founder', value: 1 }))).toBe(
      'Chegou nas primeiras semanas'
    )
  })

  it('idade da conta em anos e meses', () => {
    const conta = (value: number): string =>
      statText(badge({ category: 'conta', unit: 'months', value }))
    expect(conta(0)).toBe('Menos de 1 mês de conta')
    expect(conta(1)).toBe('1 mês de conta')
    expect(conta(7)).toBe('7 meses de conta')
    expect(conta(12)).toBe('1 ano de conta')
    expect(conta(26)).toBe('2 anos e 2 meses de conta')
  })
})

describe('formatThreshold', () => {
  it('rótulo curto da escada', () => {
    expect(formatThreshold('seconds', HOUR)).toBe('1 hora')
    expect(formatThreshold('seconds', 1000 * HOUR)).toBe('1.000 horas')
    expect(formatThreshold('months', 1)).toBe('1 mês')
    expect(formatThreshold('months', 6)).toBe('6 meses')
    expect(formatThreshold('months', 12)).toBe('1 ano')
    expect(formatThreshold('months', 24)).toBe('2 anos')
    expect(formatThreshold('months', 120)).toBe('10 anos')
    expect(formatThreshold('messages', 2000)).toBe('2.000 mensagens')
    expect(formatThreshold('level', 10)).toBe('Nível 10')
    expect(formatThreshold('people', 5)).toBe('5 pessoas')
    expect(formatThreshold('servers', 1)).toBe('1 servidor')
    expect(formatThreshold('reactions', 50)).toBe('50 reações')
    expect(formatThreshold('founder', 1)).toBe('Até 31/10/26')
  })
})

describe('remainingText', () => {
  const now = new Date('2026-10-25T12:00:00Z')

  it('quanto falta para o próximo tier', () => {
    expect(remainingText(badge({ value: 30 * HOUR, next_threshold: 50 * HOUR }), now)).toBe(
      'Faltam 20 horas'
    )
    expect(remainingText(badge({ value: 50 * 60, next_threshold: HOUR }), now)).toBe(
      'Faltam 10 min'
    )
    expect(
      remainingText(
        badge({ category: 'mensagens', unit: 'messages', value: 499, next_threshold: 500 }),
        now
      )
    ).toBe('Falta 1 mensagem')
    expect(
      remainingText(badge({ category: 'nivel', unit: 'level', value: 22, next_threshold: 25 }), now)
    ).toBe('Faltam 3 níveis')
    expect(
      remainingText(
        badge({ category: 'festeiro', unit: 'people', value: 6, next_threshold: 10 }),
        now
      )
    ).toBe('Uma call com 10 pessoas')
  })

  it('idade da conta conta pelo dia em que chega', () => {
    const conta = (nextAt: string): string =>
      remainingText(
        badge({ category: 'conta', unit: 'months', value: 2, next_threshold: 3, next_at: nextAt }),
        now
      )
    expect(conta('2027-02-25T12:00:00Z')).toBe('Faltam 4 meses')
    expect(conta('2026-11-06T12:00:00Z')).toBe('Faltam 12 dias')
    expect(conta('2026-10-26T11:00:00Z')).toBe('Falta 1 dia')
  })

  it('no último tier não falta nada', () => {
    expect(remainingText(badge({ tier: 6, value: 2000 * HOUR }), now)).toBe('Tier máximo!')
  })
})

describe('profileBadgeRow', () => {
  const list = [
    badge({ category: 'voz', tier: 2, rarity: 'comum' }),
    badge({ category: 'conta', tier: 0 }),
    badge({ category: 'mensagens', tier: 4, rarity: 'epico' }),
    badge({ category: 'streamer', tier: 1, rarity: 'comum' }),
    badge({ category: 'nivel', tier: 1, rarity: 'comum' }),
    badge({ category: 'coruja', tier: 1, rarity: 'comum' }),
    badge({ category: 'madrugador', tier: 1, rarity: 'comum' }),
    badge({ category: 'fundador', tier: 1, rarity: 'lendario' }),
    badge({ category: 'dono', tier: 1, rarity: 'raro' })
  ]

  it('mostra os conquistados, do mais raro para o mais comum, e o resto vira +N', () => {
    const { shown, overflow } = profileBadgeRow(list, 6)
    expect(shown.map((b) => b.category)).toEqual([
      'fundador',
      'mensagens',
      'dono',
      'voz',
      'streamer',
      'nivel'
    ])
    expect(overflow).toBe(2)
  })

  it('sem badges, nada', () => {
    expect(profileBadgeRow([badge()], 6)).toEqual({ shown: [], overflow: 0 })
  })
})

describe('splitBadges', () => {
  it('separa conquistados dos que dá para desbloquear', () => {
    const { earned, available } = splitBadges([
      badge({ category: 'voz', tier: 1, rarity: 'comum' }),
      badge({ category: 'conta' }),
      badge({ category: 'fundador', unit: 'founder', obtainable: false })
    ])
    expect(earned.map((b) => b.category)).toEqual(['voz'])
    expect(available.map((b) => b.category)).toEqual(['conta'])
  })
})

describe('misc', () => {
  it('percentual da barra', () => {
    expect(progressPercent(badge({ progress: 0.666 }))).toBe(67)
    expect(progressPercent(badge({ progress: 3 }))).toBe(100)
    expect(progressPercent(badge({ progress: -1 }))).toBe(0)
  })

  it('data curta dd/mm/aa', () => {
    expect(formatUnlockDate('2026-07-29T15:00:00Z')).toBe('29/07/26')
    expect(formatUnlockDate(undefined)).toBe('')
  })

  it('toda raridade tem nome e cor', () => {
    expect(RARITY.lendario.label).toBe('Lendário')
    expect(RARITY.epico.label).toBe('Épico')
    expect(RARITY.raro.color).toMatch(/^#/)
  })
})

describe('visão pública (perfil de outra pessoa)', () => {
  const tiers = [
    { tier: 1, name: 'Puxa-assunto', threshold: 50, rarity: 'comum' as const },
    { tier: 2, name: 'Papo Reto', threshold: 500, rarity: 'comum' as const },
    { tier: 3, name: 'Fofoqueiro', threshold: 2000, rarity: 'raro' as const }
  ]

  it('mostra o limite do tier conquistado, não o número exato', () => {
    const pub = badge({ category: 'mensagens', unit: 'messages', tier: 3, tiers, value: undefined })
    expect(publicStatText(pub)).toBe('2.000+ mensagens')
    const voz = badge({
      tier: 1,
      value: undefined,
      tiers: [{ tier: 1, name: 'Ouvinte', threshold: 3600, rarity: 'comum' }]
    })
    expect(publicStatText(voz)).toBe('1+ hora em call')
    const espectador = badge({
      category: 'espectador',
      name: 'Espectador',
      tier: 2,
      value: undefined,
      tiers: [
        { tier: 1, name: 'Curioso', threshold: HOUR, rarity: 'comum' },
        { tier: 2, name: 'Pipoqueiro', threshold: 10 * HOUR, rarity: 'comum' }
      ]
    })
    expect(publicStatText(espectador)).toBe('10+ horas assistindo lives')
  })

  it('fundador não tem número', () => {
    const f = badge({
      category: 'fundador',
      unit: 'founder',
      tier: 1,
      tiers: [{ tier: 1, name: 'Pioneiro', threshold: 1, rarity: 'lendario' }]
    })
    expect(publicStatText(f)).toBe('Chegou nas primeiras semanas')
  })

  it('data só com o dia não muda de dia com o fuso', () => {
    expect(formatUnlockDate('2026-07-29')).toBe('29/07/26')
  })

  it('sem value/progress (visão pública) não quebra as contas', () => {
    expect(progressPercent(badge({ progress: undefined }))).toBe(0)
    expect(splitBadges([badge({ obtainable: undefined })]).available).toEqual([])
  })
})

describe('unlockCount', () => {
  it('conta badges (categorias), não tiers', () => {
    expect(
      unlockCount([
        { category: 'voz', name: '', tier: 4, tier_name: '', rarity: 'epico' },
        { category: 'voz', name: '', tier: 3, tier_name: '', rarity: 'raro' },
        { category: 'conta', name: '', tier: 1, tier_name: '', rarity: 'comum' }
      ])
    ).toBe(2)
  })
})

describe('raridade mítica (Fundador dos devs)', () => {
  const dev = badge({
    category: 'criador',
    name: 'Fundador',
    unit: 'dev',
    value: 1,
    tier: 1,
    tier_name: 'Fundador',
    rarity: 'mitico',
    progress: 1,
    tiers: [{ tier: 1, name: 'Fundador', threshold: 1, rarity: 'mitico' }]
  })

  it('fica acima de lendário', () => {
    const order = (['comum', 'raro', 'epico', 'lendario', 'mitico'] as const).map(
      (r) => RARITY[r].rank
    )
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(new Set(order).size).toBe(order.length)
    expect(RARITY.mitico.label).toBe('Mítico')
    expect(RARITY.mitico.color).not.toBe(RARITY.lendario.color)
  })

  it('vem antes do Pioneiro na fileira do perfil', () => {
    const { shown } = profileBadgeRow([
      badge({ category: 'fundador', unit: 'founder', tier: 1, rarity: 'lendario' }),
      badge({ category: 'voz', tier: 1, rarity: 'comum' }),
      dev
    ])
    expect(shown.map((b) => b.category)).toEqual(['criador', 'fundador', 'voz'])
  })

  it('rótulo não repete o nome quando o tier se chama igual ao badge', () => {
    expect(badgeLabel(dev)).toBe('Fundador')
    expect(badgeLabel({ name: 'Tempo em call', tier_name: 'Locutor' })).toBe(
      'Locutor (Tempo em call)'
    )
  })

  it('só mítico tem efeito', () => {
    expect(isMythic('mitico')).toBe(true)
    expect(isMythic('lendario')).toBe(false)
    expect(isMythic(undefined)).toBe(false)
  })

  it('não tem número, nem no próprio perfil nem no de outra pessoa', () => {
    expect(statText(dev)).toBe('Dev do Salinha')
    expect(publicStatText({ ...dev, value: undefined, progress: undefined })).toBe('Dev do Salinha')
    expect(formatThreshold('dev', 1)).toBe('Só para os devs')
    expect(remainingText(dev)).toBe('Tier máximo!')
    expect(remainingText({ ...dev, tier: 0, next_threshold: 1, value: 0 })).toBe('Só para os devs')
  })
})

describe('holoPointer', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 }

  it('no centro não inclina', () => {
    expect(holoPointer(200, 100, rect)).toEqual({ mx: 50, my: 50, rx: 0, ry: 0 })
  })

  it('nos cantos inclina até o máximo', () => {
    expect(holoPointer(100, 50, rect, 10)).toEqual({ mx: 0, my: 0, rx: 10, ry: -10 })
    expect(holoPointer(300, 150, rect, 10)).toEqual({ mx: 100, my: 100, rx: -10, ry: 10 })
  })

  it('fora da caixa ou caixa vazia não passa do limite', () => {
    expect(holoPointer(9999, -9999, rect, 10)).toEqual({ mx: 100, my: 0, rx: 10, ry: 10 })
    expect(holoPointer(5, 5, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      mx: 50,
      my: 50,
      rx: 0,
      ry: 0
    })
  })
})

describe('visibleBadges e selectedBadge (modal de badges)', () => {
  const mk = (category: string, tier: number, obtainable = true): Badge =>
    ({ category, name: category, tier, obtainable, tiers: [] }) as unknown as Badge
  const ganho = mk('voz', 2)
  const livre = mk('chat', 0)
  const todos = [ganho, livre]

  it('no próprio perfil aparecem os ganhos e os que dá para desbloquear', () => {
    const v = visibleBadges(todos, true)
    expect(v.earned).toEqual([ganho])
    expect(v.available).toEqual([livre])
    expect(v.visible).toEqual([ganho, livre])
  })

  it('no perfil dos outros, só os ganhos', () => {
    expect(visibleBadges(todos, false).visible).toEqual([ganho])
  })

  it('sem badges carregados, tudo vazio', () => {
    expect(visibleBadges(undefined, true).visible).toEqual([])
  })

  type Alvo = { userId: string; name: string; category?: string }

  it('o escolhido vale só para a abertura em que foi escolhido', () => {
    const target: Alvo = { userId: 'u1', name: 'Ana', category: 'voz' }
    const outro: Alvo = { userId: 'u2', name: 'Bia' }
    const v = [ganho, livre]
    expect(selectedBadge(v, target, { target, category: 'chat' })).toBe(livre)
    expect(selectedBadge(v, target, { target: outro, category: 'chat' })).toBe(ganho)
  })

  it('sem escolha usa o do alvo, e se ele não existe, o primeiro', () => {
    const v = [ganho, livre]
    const alvo = (category?: string): Alvo => ({ userId: 'u1', name: 'A', category })
    expect(selectedBadge(v, alvo('chat'), null)).toBe(livre)
    expect(selectedBadge(v, alvo('nada'), null)).toBe(ganho)
    expect(selectedBadge([], alvo(), null)).toBeUndefined()
  })
})

describe('Fez o L (resposta única do segundo turno)', () => {
  const l = badge({
    category: 'l',
    name: 'Fez o L',
    unit: 'vote',
    value: 1,
    tier: 1,
    tier_name: 'Fez o L',
    rarity: 'lendario',
    tiers: [{ tier: 1, name: 'Fez o L', threshold: 1, rarity: 'lendario' }]
  })

  it('não mostra número: diz o que a pessoa fez', () => {
    expect(statText(l)).toBe('Fez o L no segundo turno')
    expect(formatThreshold('vote', 1)).toBe('Fez o L')
  })

  it('no perfil dos outros não vira "Fez+ o L"', () => {
    expect(publicStatText({ ...l, value: undefined, progress: undefined })).toBe(
      'Fez o L no segundo turno'
    )
  })

  it('o nome não se repete no rótulo', () => {
    expect(badgeLabel(l)).toBe('Fez o L')
  })

  it('formatThreshold com a categoria l mantém o rótulo do L', () => {
    expect(formatThreshold('vote', 1, 'l')).toBe('Fez o L')
  })

  describe('Fez o 22 (v22)', () => {
    const v22 = {
      ...l,
      category: 'v22',
      name: 'Fez o 22',
      tier_name: 'Fez o 22',
      tiers: [{ tier: 1, name: 'Fez o 22', threshold: 1, rarity: 'lendario' as const }]
    }

    it('statText diz o 22, não o L', () => {
      expect(statText(v22)).toBe('Fez o 22 no segundo turno')
    })

    it('publicStatText diz o 22, não o L', () => {
      expect(publicStatText({ ...v22, value: undefined, progress: undefined })).toBe(
        'Fez o 22 no segundo turno'
      )
    })

    it('formatThreshold diz o 22, não o L', () => {
      expect(formatThreshold('vote', 1, 'v22')).toBe('Fez o 22')
    })
  })
})

describe('unlocksComAviso', () => {
  const unlock = (category: string): BadgeUnlockEvent['unlocks'][number] => ({
    category,
    name: category,
    tier: 1,
    tier_name: category,
    rarity: 'lendario'
  })

  it('l e v22 têm celebração própria e ficam fora do aviso genérico', () => {
    const lista = [unlock('l'), unlock('voz'), unlock('v22')]
    expect(unlocksComAviso(lista).map((u) => u.category)).toEqual(['voz'])
  })
})
