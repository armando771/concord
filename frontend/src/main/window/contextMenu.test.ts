import { describe, expect, it } from 'vitest'
import { contextMenuItems, type ContextMenuParams } from './contextMenu'

const flags = {
  canCut: true,
  canCopy: true,
  canPaste: true,
  canSelectAll: true
}

function params(extra: Partial<ContextMenuParams> = {}): ContextMenuParams {
  return { selectionText: '', linkURL: '', isEditable: false, editFlags: flags, ...extra }
}

const labels = (p: ContextMenuParams): string[] =>
  contextMenuItems(p).map((i) => ('label' in i ? i.label : '—'))

describe('contextMenuItems', () => {
  it('nada selecionado, fora de link e de campo: sem menu', () => {
    expect(contextMenuItems(params())).toEqual([])
    expect(contextMenuItems(params({ selectionText: '   ' }))).toEqual([])
  })

  it('texto selecionado: Copiar', () => {
    expect(contextMenuItems(params({ selectionText: 'oi' }))).toEqual([
      { label: 'Copiar', role: 'copy' }
    ])
  })

  it('link http(s): Copiar link e Abrir no navegador', () => {
    expect(contextMenuItems(params({ linkURL: 'https://x.com/a' }))).toEqual([
      { label: 'Copiar link', action: 'copyLink', url: 'https://x.com/a' },
      { label: 'Abrir no navegador', action: 'openLink', url: 'https://x.com/a' }
    ])
  })

  it('link de outro esquema: só copiar, nunca abrir', () => {
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'smb://x/y']) {
      expect(labels(params({ linkURL: url }))).toEqual(['Copiar link'])
    }
  })

  it('seleção sobre link: Copiar, separador e as opções do link', () => {
    expect(labels(params({ selectionText: 'x.com', linkURL: 'https://x.com' }))).toEqual([
      'Copiar',
      '—',
      'Copiar link',
      'Abrir no navegador'
    ])
  })

  it('campo editável: Recortar, Copiar, Colar e Selecionar tudo, conforme o que dá', () => {
    expect(
      contextMenuItems(
        params({ isEditable: true, editFlags: { ...flags, canCut: false, canCopy: false } })
      )
    ).toEqual([
      { label: 'Recortar', role: 'cut', enabled: false },
      { label: 'Copiar', role: 'copy', enabled: false },
      { label: 'Colar', role: 'paste', enabled: true },
      { type: 'separator' },
      { label: 'Selecionar tudo', role: 'selectAll', enabled: true }
    ])
  })
})
