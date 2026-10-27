import { describe, expect, it } from 'vitest'
import { nextTab, panelId, tabId } from './profileTabs'

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
