import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ProfileCardFrame from './ProfileCardFrame'
import { DEFAULT_PROFILE_THEME, profileThemeLook } from '../lib/profileTheme'

const render = (effect: string, withProp = true): string => {
  const theme = { ...DEFAULT_PROFILE_THEME, effect, effect_density: 100 }
  return renderToStaticMarkup(
    <ProfileCardFrame look={profileThemeLook(theme)} effect={withProp ? effect : undefined}>
      <p>corpo</p>
    </ProfileCardFrame>
  )
}

describe('ProfileCardFrame', () => {
  it('efeito em CSS: partículas (mais com quantidade alta)', () => {
    const html = render('sparkles')
    expect(html).toContain('pt-fx-sparkles')
    expect(html).toContain('✦')
    expect(html.match(/<span/g)?.length).toBeGreaterThan(10)
    expect(render('snow')).toContain('top:-8px')
  })
  it('efeito em canvas: um <canvas> decorativo', () => {
    const html = render('fire')
    expect(html).toContain('<canvas')
    expect(html).toContain('aria-hidden="true"')
  })
  it('sem efeito, ou sem pedir o efeito: só o corpo', () => {
    expect(render('none')).not.toContain('class="pt-fx')
    expect(render('fire', false)).not.toContain('canvas')
    expect(render('none')).toContain('corpo')
  })
})
