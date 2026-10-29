import { beforeEach, describe, expect, it } from 'vitest'
import { useScreenStatsStore } from './screenStatsStore'

describe('screenStatsStore', () => {
  beforeEach(() => useScreenStatsStore.getState().close())

  it('abre e fecha o painel da mesma live', () => {
    useScreenStatsStore.getState().toggle('bia')
    expect(useScreenStatsStore.getState().openFor).toBe('bia')
    useScreenStatsStore.getState().toggle('bia')
    expect(useScreenStatsStore.getState().openFor).toBeNull()
  })

  it('abrir outra live troca o painel (um por vez)', () => {
    useScreenStatsStore.getState().toggle('bia')
    useScreenStatsStore.getState().toggle('caio')
    expect(useScreenStatsStore.getState().openFor).toBe('caio')
    useScreenStatsStore.getState().close()
    expect(useScreenStatsStore.getState().openFor).toBeNull()
  })
})
