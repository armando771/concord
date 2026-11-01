import { beforeEach, describe, expect, it } from 'vitest'
import { useScreenAdaptStore, type ScreenAdaptView } from './screenAdaptStore'
import { useToastStore } from '../../../shared/store/toastStore'

const full: ScreenAdaptView = {
  chosen: '1080p 60',
  effective: '1080p 60',
  reduced: false,
  reason: null,
  step: 0
}

beforeEach(() => {
  useScreenAdaptStore.setState({ view: null })
  useToastStore.setState({ toasts: [] })
})

describe('screenAdaptStore', () => {
  it('descer de degrau avisa quem transmite; voltar não avisa', () => {
    const { setView } = useScreenAdaptStore.getState()
    setView(full)
    expect(useToastStore.getState().toasts).toHaveLength(0)
    setView({ ...full, effective: '720p 60', reduced: true, reason: 'bandwidth', step: 1 })
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual([
      'Qualidade reduzida para 720p 60 pela sua conexão.'
    ])
    setView(full)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useScreenAdaptStore.getState().view).toEqual(full)
  })
})
