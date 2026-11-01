import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./ReactionTooltip', () => ({ default: () => null }))

import ReactionChips from './ReactionChips'

const reactions = [
  { emoji: '🔥', count: 2, user_ids: ['ana', 'bia'] },
  { emoji: '👍', count: 1, user_ids: ['bia'] }
]

function render(canReact = true): string {
  return renderToStaticMarkup(
    <ReactionChips
      reactions={reactions}
      meId="ana"
      canReact={canReact}
      onReact={() => {}}
      onOpenPicker={() => {}}
    />
  )
}

describe('ReactionChips', () => {
  it('sem reações não ocupa espaço', () => {
    const html = renderToStaticMarkup(
      <ReactionChips
        reactions={[]}
        meId="ana"
        canReact
        onReact={() => {}}
        onOpenPicker={() => {}}
      />
    )
    expect(html).toBe('')
  })

  it('pílulas no tamanho do Discord: 28px de altura, emoji de 20px e contagem de 14px', () => {
    const html = render()
    expect(html).toContain('h-7')
    expect(html).toContain('text-[20px]')
    expect(html).toContain('text-ds-sm')
  })

  it('a minha reação fica destacada (borda e fundo da marca); a dos outros, cinza', () => {
    const html = render()
    const [mine, other] = html.split('<button').slice(1)
    expect(mine).toContain('aria-pressed="true"')
    expect(mine).toContain('border-brand')
    expect(other).toContain('aria-pressed="false"')
    expect(other).toContain('bg-fg/5')
    expect(html).toContain('aria-label="🔥: 2 reações"')
    expect(html).toContain('aria-label="👍: 1 reação"')
  })

  it('botão de adicionar reação no fim, só com permissão', () => {
    expect(render()).toContain('aria-label="Adicionar reação"')
    expect(render(false)).not.toContain('aria-label="Adicionar reação"')
  })

  it('sem permissão, a reação dos outros fica travada (a minha dá para tirar)', () => {
    const [mine, other] = render(false).split('<button').slice(1)
    expect(mine).not.toContain('aria-disabled')
    expect(other).toContain('aria-disabled="true"')
  })
})
