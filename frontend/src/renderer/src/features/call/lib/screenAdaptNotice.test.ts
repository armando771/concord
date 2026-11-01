import { describe, expect, it } from 'vitest'
import { adaptDropNotice, adaptStatusText } from './screenAdaptNotice'
import type { ScreenAdaptView } from '../store/screenAdaptStore'

const full: ScreenAdaptView = {
  chosen: '1080p 60',
  effective: '1080p 60',
  reduced: false,
  reason: null,
  step: 0
}
const down = (effective: string, step: number, reason: 'cpu' | 'bandwidth' = 'bandwidth') => ({
  ...full,
  effective,
  reduced: true,
  reason,
  step
})

describe('adaptDropNotice', () => {
  it('avisa quando desce de degrau, com o motivo', () => {
    expect(adaptDropNotice(full, down('720p 60', 1))).toBe(
      'Qualidade reduzida para 720p 60 pela sua conexão.'
    )
    expect(adaptDropNotice(down('720p 60', 1, 'cpu'), down('720p 30', 2, 'cpu'))).toBe(
      'Qualidade reduzida para 720p 30 pelo seu PC.'
    )
  })

  it('subindo, igual, trocando a escolha ou parando: sem aviso', () => {
    expect(adaptDropNotice(down('720p 30', 2), down('720p 60', 1))).toBeNull()
    expect(adaptDropNotice(down('720p 60', 1), down('720p 60', 1))).toBeNull()
    expect(adaptDropNotice(full, { ...down('720p 30', 1), chosen: '720p 60' })).toBeNull()
    expect(adaptDropNotice(full, null)).toBeNull()
    expect(adaptDropNotice(null, full)).toBeNull()
  })
})

describe('adaptStatusText', () => {
  it('reduzida, limitada no piso ou normal', () => {
    expect(adaptStatusText(down('720p 60', 1))).toBe('Saindo em 720p 60 pela sua conexão.')
    expect(adaptStatusText({ ...full, chosen: '720p 30', effective: '720p 30', reason: 'cpu' })).toBe(
      'Seu PC não está dando conta de 720p 30.'
    )
    expect(adaptStatusText(full)).toBeNull()
    expect(adaptStatusText(null)).toBeNull()
  })
})
