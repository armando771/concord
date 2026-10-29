import { describe, expect, it, vi } from 'vitest'
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

import Modal from './Modal'
import ToastContainer from './ToastContainer'

/** Camada mais alta usada por menus de contexto (z-[80]) no app. */
const CAMADA_MAIS_ALTA_DO_APP = 80

function zIndexDoPrimeiroWrapper(html: string): number {
  const classe = /class="([^"]*\bfixed\b[^"]*)"/.exec(html)?.[1] ?? ''
  const z = /\bz-(?:\[(\d+)\]|(\d+))/.exec(classe)
  return Number(z?.[1] ?? z?.[2])
}

describe('camadas: avisos (toasts) x janelas', () => {
  const toast = zIndexDoPrimeiroWrapper(renderToStaticMarkup(<ToastContainer />))
  const modal = zIndexDoPrimeiroWrapper(renderToStaticMarkup(<Modal open title="x" />))

  it('o aviso fica na frente do fundo desfocado do Modal', () => {
    expect(toast).toBeGreaterThan(modal)
  })

  it('o aviso fica na frente de todas as camadas do app', () => {
    expect(toast).toBeGreaterThan(CAMADA_MAIS_ALTA_DO_APP)
  })
})
