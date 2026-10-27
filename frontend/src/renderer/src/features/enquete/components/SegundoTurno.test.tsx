import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  state: {
    estado: { elegivel: true, respondeu: false, fez_o_l: false } as unknown,
    dispensado: false,
    reacao: null as unknown,
    enviando: false,
    erro: false
  },
  acoes: {
    carregar: vi.fn(),
    reset: vi.fn(),
    responder: vi.fn(),
    dispensar: vi.fn(),
    reabrir: vi.fn(),
    fecharReacao: vi.fn()
  },
  userId: 'me' as string | undefined
}))
vi.mock('../store/segundoTurnoStore', () => ({
  useSegundoTurnoStore: (select: (s: unknown) => unknown) =>
    select({ ...store.state, ...store.acoes })
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (select: (s: unknown) => unknown) =>
    select({ user: store.userId ? { id: store.userId } : null })
}))
// Sem DOM: o portal vira o próprio conteúdo.
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (node: React.ReactNode) => node
}))

import { renderToStaticMarkup } from 'react-dom/server'
import SegundoTurnoBanner from './SegundoTurnoBanner'
import SegundoTurnoCelebracao from './SegundoTurnoCelebracao'
import SegundoTurnoHost from './SegundoTurnoHost'
import SegundoTurnoTriste from './SegundoTurnoTriste'
import { useBotaoSegundoTurno } from '../hooks/useBotaoSegundoTurno'

function botao(): ReturnType<typeof useBotaoSegundoTurno> {
  let out!: ReturnType<typeof useBotaoSegundoTurno>
  function Sonda(): null {
    out = useBotaoSegundoTurno()
    return null
  }
  renderToStaticMarkup(<Sonda />)
  return out
}

describe('segundo turno (componentes)', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { body: {} })
    store.state = {
      estado: { elegivel: true, respondeu: false, fez_o_l: false },
      dispensado: false,
      reacao: null,
      enviando: false,
      erro: false
    }
    store.userId = 'me'
    Object.values(store.acoes).forEach((fn) => fn.mockReset())
  })

  describe('banner', () => {
    it('pergunta, oferece sim e não e tem como fechar', () => {
      const html = renderToStaticMarkup(<SegundoTurnoBanner />)
      expect(html).toContain('role="dialog"')
      expect(html).toContain('aria-modal="true"')
      expect(html).toContain('Você fez o L no segundo turno?')
      expect(html).toContain('Fiz o L')
      expect(html).toContain('Não fiz')
      expect(html).toContain('aria-label="Fechar"')
    })

    it('em 360 px os botões empilham e têm alvo de toque de 44 px; o cartão não passa da tela', () => {
      const html = renderToStaticMarkup(<SegundoTurnoBanner />)
      expect(html).toMatch(/flex-col[^"]*sm:flex-row/)
      expect(html).toContain('min-h-11')
      expect(html).toContain('w-full')
      expect(html).toContain('max-w-sm')
    })

    it('enquanto envia, desabilita os dois botões', () => {
      store.state.enviando = true
      const html = renderToStaticMarkup(<SegundoTurnoBanner />)
      expect(html.match(/disabled=""/g)?.length).toBe(2)
    })

    it('mostra o erro de envio (e só nesse caso)', () => {
      expect(renderToStaticMarkup(<SegundoTurnoBanner />)).not.toContain('role="alert"')
      store.state.erro = true
      const html = renderToStaticMarkup(<SegundoTurnoBanner />)
      expect(html).toContain('role="alert"')
      expect(html).toContain('Não foi possível enviar. Tente de novo.')
    })
  })

  describe('celebração', () => {
    it('anuncia o badge conquistado com a arte grande e animada', () => {
      const html = renderToStaticMarkup(<SegundoTurnoCelebracao />)
      expect(html).toContain('role="dialog"')
      expect(html).toContain('Badge conquistado!')
      expect(html).toContain('Fez o L')
      expect(html).toContain('segundo-turno-badge')
      expect(html).toContain('width:224px')
    })
  })

  describe('reação triste', () => {
    it('consola e deixa fechar', () => {
      const html = renderToStaticMarkup(<SegundoTurnoTriste />)
      expect(html).toContain('role="dialog"')
      expect(html).toContain('Poxa… tudo bem, cada um com a sua escolha.')
      expect(html).toContain('aria-label="Fechar"')
    })
  })

  describe('host', () => {
    it('elegível e sem resposta: mostra o banner', () => {
      expect(renderToStaticMarkup(<SegundoTurnoHost />)).toContain('Você fez o L no segundo turno?')
    })

    it('dispensado ou respondido: nada na tela', () => {
      store.state.dispensado = true
      expect(renderToStaticMarkup(<SegundoTurnoHost />)).toBe('')
      store.state.dispensado = false
      store.state.estado = { elegivel: true, respondeu: true, fez_o_l: false }
      expect(renderToStaticMarkup(<SegundoTurnoHost />)).toBe('')
    })

    it('conta fora do corte: nada na tela', () => {
      store.state.estado = { elegivel: false, respondeu: false, fez_o_l: false }
      expect(renderToStaticMarkup(<SegundoTurnoHost />)).toBe('')
    })

    it('mostra a reação ao responder', () => {
      store.state.estado = { elegivel: true, respondeu: true, fez_o_l: true }
      store.state.reacao = 'sim'
      expect(renderToStaticMarkup(<SegundoTurnoHost />)).toContain('Badge conquistado!')
      store.state.reacao = 'nao'
      expect(renderToStaticMarkup(<SegundoTurnoHost />)).toContain('Poxa…')
    })
  })

  describe('botão da barra', () => {
    it('só aparece com o banner dispensado e sem resposta', () => {
      expect(botao().visivel).toBe(false)
      store.state.dispensado = true
      expect(botao().visivel).toBe(true)
      store.state.estado = { elegivel: true, respondeu: true, fez_o_l: true }
      expect(botao().visivel).toBe(false)
    })

    it('clicar reabre o banner', () => {
      store.state.dispensado = true
      botao().reabrir()
      expect(store.acoes.reabrir).toHaveBeenCalledTimes(1)
    })
  })
})
