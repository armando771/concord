import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TTSVoiceState } from '../../../../../shared/ttsVoice'
import TTSVoiceStatus from './TTSVoiceStatus'

const render = (state: TTSVoiceState | null): string =>
  renderToStaticMarkup(<TTSVoiceStatus voice={{ state, prepare: vi.fn() }} />)

describe('TTSVoiceStatus', () => {
  it('antes de o main responder, nada', () => {
    expect(render(null)).toBe('')
  })

  it('baixando: mostra o progresso, sem botão', () => {
    const html = render({ status: 'downloading', percent: 37 })
    expect(html).toContain('Baixando a voz de leitura… 37%')
    expect(html).not.toContain('<button')
    expect(html).toContain('text-gray-400')
  })

  it('erro: aviso e "Tentar de novo"', () => {
    const html = render({ status: 'error' })
    expect(html).toContain('text-warning')
    expect(html).toContain('Tentar de novo')
  })
})
