import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ToastContainer } from './ToastContainer'

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
})
