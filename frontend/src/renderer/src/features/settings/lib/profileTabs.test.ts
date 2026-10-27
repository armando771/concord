import { describe, expect, it } from 'vitest'
import { nextTab, panelId, tabId, cardNotice, tabAlert } from './profileTabs'

describe('profileTabs', () => {
  it('setas andam e dão a volta; outras teclas não', () => {
    expect(nextTab('identity', 'ArrowRight')).toBe('appearance')
    expect(nextTab('appearance', 'ArrowRight')).toBe('identity')
    expect(nextTab('identity', 'ArrowLeft')).toBe('appearance')
    expect(nextTab('identity', 'Enter')).toBeNull()
  })
  it('ids da aba e do painel', () => {
    expect(tabId('identity')).toBe('profile-tab-identity')
    expect(panelId('appearance')).toBe('profile-panel-appearance')
  })
})

describe('avisos de erro', () => {
  it('a aba Identidade só acende com erro nos campos dela', () => {
    expect(tabAlert({ bio: 'longa' })).toBe('identity')
    expect(tabAlert({ linkErrors: ['ruim'] })).toBe('identity')
    expect(tabAlert({ display_name: 'vazio', pronouns: 'longo' })).toBeNull()
    expect(tabAlert({})).toBeNull()
  })
  it('nome e pronomes (editados no cartão) avisam embaixo do cartão', () => {
    expect(cardNotice({ display_name: 'vazio' })).toMatch(/clique/)
    expect(cardNotice({ pronouns: 'longo' })).toMatch(/clique/)
    expect(cardNotice({ bio: 'longa' })).toBeNull()
  })
})
