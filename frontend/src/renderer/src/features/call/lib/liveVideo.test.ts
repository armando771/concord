import { describe, expect, it } from 'vitest'
import { closesStatsPanel, liveOwner } from './liveVideo'

const stream = (): MediaStream => ({}) as MediaStream

describe('liveOwner', () => {
  const mine = stream()
  const bia = stream()
  const camera = stream()

  it('minha tela, a de quem assisto ou nenhuma (câmera)', () => {
    expect(liveOwner(mine, mine, { bia }, 'eu')).toEqual({ userId: 'eu', local: true })
    expect(liveOwner(bia, mine, { bia }, 'eu')).toEqual({ userId: 'bia', local: false })
    expect(liveOwner(camera, mine, { bia }, 'eu')).toBeNull()
    expect(liveOwner(camera, null, {}, 'eu')).toBeNull()
  })

  it('Esc fecha o painel; outras teclas não', () => {
    expect(closesStatsPanel('Escape')).toBe(true)
    expect(closesStatsPanel('Enter')).toBe(false)
  })
})
