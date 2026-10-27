import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ToastMessage } from '../store/toastStore'
import { Toast, ToastContainer } from './ToastContainer'

describe('ToastContainer', () => {
  it('em tela estreita ocupa de margem a margem (não sai pela esquerda)', () => {
    const html = renderToStaticMarkup(<ToastContainer />)
    expect(html).toContain('inset-x-4')
  })

  it('a partir de sm volta para o canto direito, com largura limitada', () => {
    const html = renderToStaticMarkup(<ToastContainer />)
    expect(html).toContain('sm:left-auto')
    expect(html).toContain('sm:max-w-sm')
  })

  it('sem largura total fixa na base (w-full + right-N estourava a esquerda)', () => {
    const html = renderToStaticMarkup(<ToastContainer />)
    expect(html).not.toMatch(/[\s"]w-full/)
  })

  describe('Toast', () => {
    const aviso = (extra: Partial<ToastMessage>): ToastMessage => ({
      id: 'a',
      type: 'info',
      message: 'Mensagem',
      ...extra
    })

    it.each([
      ['success', 'Sucesso'],
      ['error', 'Erro'],
      ['warning', 'Alerta'],
      ['info', 'Informação']
    ] as const)('padroniza o aviso de %s com rótulo para leitor de tela', (type, rotulo) => {
      const html = renderToStaticMarkup(<Toast toast={aviso({ type })} />)
      expect(html).toContain(`${rotulo}: `)
      expect(html).toContain('Mensagem')
      expect(html).toContain('toast-in')
      expect(html).not.toMatch(/✅|❌|ℹ️/u)
    })

    it('aviso saindo usa a animação de saída', () => {
      const html = renderToStaticMarkup(<Toast toast={aviso({ leaving: true })} />)
      expect(html).toContain('toast-out')
    })
  })
})
