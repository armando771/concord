import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import NoticeStack from './NoticeStack'

describe('NoticeStack', () => {
  it('empilha os avisos num canto só (não um em cima do outro)', () => {
    const html = renderToStaticMarkup(
      <NoticeStack>
        <p>um</p>
        <p>dois</p>
      </NoticeStack>
    )
    expect(html).toContain('flex-col')
    expect(html).toContain('um')
    expect(html).toContain('dois')
  })

  it('fica acima da barra do usuário e cabe em 360 px', () => {
    const html = renderToStaticMarkup(<NoticeStack>x</NoticeStack>)
    expect(html).toContain('bottom-20')
    expect(html).toContain('max-w-[calc(100vw-2rem)]')
  })
})
