import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../call/store/callStore', () => ({ useCallStore: () => undefined }))

import { UpdateBarView } from './UpdateBar'

const base = {
  version: '1.2.0',
  ready: false,
  requested: false,
  progress: 0,
  error: null,
  confirming: false,
  inCall: false,
  callType: null,
  onInstall: () => {},
  onConfirm: () => {},
  onCancel: () => {}
} as const

const render = (over: Partial<Parameters<typeof UpdateBarView>[0]> = {}): string =>
  renderToStaticMarkup(<UpdateBarView {...base} {...over} />)

describe('UpdateBarView', () => {
  it('mostra a versão e o botão Atualizar', () => {
    const html = render()
    expect(html).toContain('Versão 1.2.0 disponível')
    expect(html).toContain('Atualizar')
    expect(html).toContain('<button')
    expect(html).not.toContain('Depois')
  })

  it('pedindo confirmação em canal: avisa que volta ao canal', () => {
    const html = render({ inCall: true, confirming: true, callType: 'channel' })
    expect(html).toContain('Atualizar mesmo assim')
    expect(html).toContain('Você voltará automaticamente ao canal')
    expect(html).toContain('Cancelar')
  })

  it('pedindo confirmação em DM: avisa que sai da chamada', () => {
    const html = render({ inCall: true, confirming: true, callType: 'dm' })
    expect(html).toContain('vai te tirar da chamada')
  })

  it('baixando: mostra o progresso e esconde o botão', () => {
    const html = render({ requested: true, progress: 40 })
    expect(html).toContain('Baixando a versão 1.2.0… 40%')
    expect(html).not.toContain('<button')
  })

  it('baixando sozinho em segundo plano: mostra o progresso e mantém o botão', () => {
    const html = render({ progress: 40 })
    expect(html).toContain('Baixando a versão 1.2.0… 40%')
    expect(html).toContain('<button')
    expect(html).toContain('Atualizar')
  })

  it('baixada e verificada: volta para "disponível" e o botão instala', () => {
    const html = render({ ready: true, progress: 100 })
    expect(html).toContain('Versão 1.2.0 disponível')
    expect(html).toContain('Atualizar')
  })

  it('confirmação em chamada aparece no lugar do progresso', () => {
    const html = render({ progress: 40, inCall: true, confirming: true, callType: 'dm' })
    expect(html).toContain('vai te tirar da chamada')
    expect(html).not.toContain('40%')
  })

  it('baixada: mostra que está reiniciando', () => {
    const html = render({ requested: true, ready: true, progress: 100 })
    expect(html).toContain('Reiniciando para instalar a versão 1.2.0')
  })

  it('erro aparece no lugar do texto da versão', () => {
    const html = render({ error: 'Não foi possível instalar a atualização.' })
    expect(html).toContain('Não foi possível instalar a atualização.')
  })
})
