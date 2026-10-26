import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const joinRequests = [{ id: 'u1', username: 'ana', display_name: 'Ana' }]
vi.mock('../store/callStore', () => ({
  useCallStore: (select: (s: unknown) => unknown) =>
    select({ joinRequests, respondJoinRequest: vi.fn() })
}))
import { JoinRequestsStack } from './JoinRequestsStack'

describe('JoinRequestsStack', () => {
  it('em tela estreita ocupa de margem a margem (não sai pela esquerda)', () => {
    const html = renderToStaticMarkup(<JoinRequestsStack />)
    expect(html).toContain('inset-x-4')
    expect(html).toContain('sm:left-auto')
  })

  it('sem largura total fixa na base', () => {
    expect(renderToStaticMarkup(<JoinRequestsStack />)).not.toMatch(/[\s"]w-full/)
  })
})
