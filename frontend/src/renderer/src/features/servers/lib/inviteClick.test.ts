import { describe, expect, it } from 'vitest'
import { inviteCodeFromClick, type LinkClick } from './inviteClick'

const LINK = 'https://app-salinha.bhrx.com.br/convite/K7P2QX9M'
const base: LinkClick = {
  href: LINK,
  button: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false
}

describe('inviteCodeFromClick', () => {
  it('clique simples num convite nosso devolve o código', () => {
    expect(inviteCodeFromClick(base, [])).toBe('K7P2QX9M')
  })

  it('usa a origem do servidor do build (PUBLIC_URL)', () => {
    const click = { ...base, href: 'https://1-2-3-4.sslip.io/convite/ABCD2345' }
    expect(inviteCodeFromClick(click, [])).toBeNull()
    expect(inviteCodeFromClick(click, ['https://1-2-3-4.sslip.io'])).toBe('ABCD2345')
  })

  it('link de outro site ou sem href não é nosso', () => {
    expect(
      inviteCodeFromClick({ ...base, href: 'https://exemplo.com/convite/K7P2QX9M' }, [])
    ).toBeNull()
    expect(inviteCodeFromClick({ ...base, href: null }, [])).toBeNull()
  })

  it('botão do meio, teclas modificadoras e clique já tratado ficam de fora', () => {
    for (const patch of [
      { button: 1 },
      { button: 2 },
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { defaultPrevented: true }
    ]) {
      expect(inviteCodeFromClick({ ...base, ...patch }, []), JSON.stringify(patch)).toBeNull()
    }
  })
})
