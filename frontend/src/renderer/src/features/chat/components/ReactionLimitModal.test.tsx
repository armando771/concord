import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// SSR lê o estado atual do zustand e não tem portal.
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) =>
  getSnapshot()
)
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  createPortal: (node: React.ReactNode) => node
}))

vi.stubGlobal('document', { body: {} })

import { useReactionLimitStore } from '../store/reactionLimitStore'
import ReactionLimitModal from './ReactionLimitModal'

describe('ReactionLimitModal', () => {
  beforeEach(() => useReactionLimitStore.setState({ open: false }))

  it('fechado, não mostra nada', () => {
    expect(renderToStaticMarkup(<ReactionLimitModal />)).toBe('')
  })

  it('aberto: título, explicação e o botão Ok', () => {
    useReactionLimitStore.getState().show()
    const html = renderToStaticMarkup(<ReactionLimitModal />)
    expect(html).toContain('Calma lá, empolgação!')
    expect(html).toContain(
      'Sua reação não foi adicionada porque esta mensagem já tem reações demais.'
    )
    expect(html).toContain('>Ok<')
    expect(html).toContain('role="dialog"')
  })

  it('o store abre e fecha o aviso', () => {
    useReactionLimitStore.getState().show()
    useReactionLimitStore.getState().close()
    expect(useReactionLimitStore.getState().open).toBe(false)
  })
})
