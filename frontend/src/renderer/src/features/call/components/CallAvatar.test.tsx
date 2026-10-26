import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CallAvatar from './CallAvatar'

const GIF = '/api/profile-media/a_33333333-3333-3333-3333-333333333333'

describe('CallAvatar', () => {
  it('mostra o GIF animado o tempo todo, sem o quadro parado nem depender do hover', () => {
    const html = renderToStaticMarkup(
      <CallAvatar userId="u1" name="Ana" avatarUrl={GIF} size={24} />
    )

    expect(html).toContain(`${GIF}"`)
    expect(html).not.toContain('/static')
    expect(html).not.toContain('group-hover')
  })

  it('imagem comum e inicial continuam iguais', () => {
    const png = renderToStaticMarkup(
      <CallAvatar name="Ana" avatarUrl="/api/profile-media/uuid" size={24} />
    )
    const inicial = renderToStaticMarkup(<CallAvatar name="ana" size={24} />)

    expect(png).toContain('/api/profile-media/uuid"')
    expect(inicial).toContain('>A<')
  })
})
