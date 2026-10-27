import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('window', { innerWidth: 360, innerHeight: 640 })
vi.stubGlobal('document', { body: {}, activeElement: null })
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  createPortal: (node: React.ReactNode) => node
}))

import { QUICK_EMOTES } from '../lib/emotes'
import { messageMenuGroups } from '../lib/messageMenu'
import MessageActionsBar from './MessageActionsBar'
import MessageMoreMenu from './MessageMoreMenu'

const noop = (): void => {}

describe('MessageActionsBar', () => {
  it('barra de ícones: 3 reações rápidas, adicionar reação, responder e Mais', () => {
    const html = renderToStaticMarkup(
      <MessageActionsBar canReact onReact={noop} onTogglePicker={noop} onReply={noop} />
    )
    for (const emoji of QUICK_EMOTES.slice(0, 3)) {
      expect(html).toContain(`aria-label="Reagir com ${emoji}"`)
    }
    expect(html).not.toContain(`Reagir com ${QUICK_EMOTES[3]}`)
    expect(html).toContain('role="separator"')
    expect(html).toContain('aria-label="Adicionar reação"')
    expect(html).toContain('aria-label="Responder"')
    expect(html).toContain('title="Responder"')
    expect(html).toContain('aria-label="Mais"')
    expect(html).toContain('aria-haspopup="menu"')
  })

  it('sem textos soltos de ação na barra (vão para o "Mais")', () => {
    const html = renderToStaticMarkup(
      <MessageActionsBar
        canReact
        onReact={noop}
        onTogglePicker={noop}
        onReply={noop}
        onCopy={noop}
        onEdit={noop}
        canPin
        onTogglePin={noop}
        onDelete={noop}
      />
    )
    expect(html).not.toContain('>Responder<')
    expect(html).not.toContain('>Fixar<')
    expect(html).not.toContain('>Excluir<')
  })

  it('sem permissão de reagir: só responder e Mais', () => {
    const html = renderToStaticMarkup(
      <MessageActionsBar canReact={false} onReact={noop} onTogglePicker={noop} onReply={noop} />
    )
    expect(html).not.toContain('Reagir com')
    expect(html).not.toContain('Adicionar reação')
    expect(html).toContain('aria-label="Responder"')
    expect(html).toContain('aria-label="Mais"')
  })

  it('menu aberto marca o "…" como expandido', () => {
    const html = renderToStaticMarkup(
      <MessageActionsBar
        canReact
        onReact={noop}
        onTogglePicker={noop}
        onReply={noop}
        menuOpen
        onMenuOpenChange={noop}
      />
    )
    expect(html).toContain('aria-expanded="true"')
  })
})

describe('MessageMoreMenu', () => {
  const anchor = {
    getBoundingClientRect: () => ({ top: 100, bottom: 132, left: 300, right: 332 }),
    contains: () => false,
    focus: noop
  } as unknown as HTMLElement

  it('itens em grupos com divisória, excluir em vermelho', () => {
    const groups = messageMenuGroups({
      canReact: true,
      canEdit: true,
      canPin: true,
      isPinned: false,
      canCopy: true,
      canDelete: true,
      deleteLabel: 'Excluir mensagem'
    })
    const html = renderToStaticMarkup(
      <MessageMoreMenu anchor={anchor} groups={groups} onAction={noop} onClose={noop} />
    )
    expect(html).toContain('role="menu"')
    expect(html.match(/role="menuitem"/g)).toHaveLength(6)
    expect(html.match(/role="separator"/g)).toHaveLength(2)
    for (const label of [
      'Adicionar reação',
      'Editar mensagem',
      'Responder',
      'Fixar mensagem',
      'Copiar texto'
    ]) {
      expect(html).toContain(`>${label}<`)
    }
    expect(html).toMatch(/text-danger[^>]*>Excluir mensagem</)
  })
})
