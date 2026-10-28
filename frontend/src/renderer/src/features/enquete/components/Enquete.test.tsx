import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  acoes: {
    carregar: vi.fn(),
    reset: vi.fn(),
    selecionar: vi.fn(),
    continuar: vi.fn(),
    voltar: vi.fn(),
    confirmar: vi.fn(),
    fecharReacao: vi.fn()
  },
  userId: 'me' as string | undefined
}))
vi.mock('../store/enqueteStore', () => ({
  useEnqueteStore: (select: (s: unknown) => unknown) => select({ ...store.state, ...store.acoes })
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
import EnqueteHost from './EnqueteHost'

const enquete = {
  id: 'segundo-turno',
  titulo: 'Ganhe um badge da sua escolha no segundo turno:',
  descricao: 'A escolha é definitiva.',
  opcoes: [
    { id: 'l', rotulo: 'L', badge: 'l' },
    { id: '22', rotulo: '22', badge: 'v22' },
    { id: 'nulo', rotulo: 'Nulo', badge: 'nulo' }
  ]
}

function estado(over: Record<string, unknown> = {}): void {
  store.state = {
    pendentes: [enquete],
    selecao: null,
    etapa: 'pergunta',
    reacao: null,
    enviando: false,
    erro: false,
    ...over
  }
}

const render = (): string => renderToStaticMarkup(<EnqueteHost />)

describe('enquete (componentes)', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { body: {} })
    store.userId = 'me'
    Object.values(store.acoes).forEach((fn) => fn.mockReset())
    estado()
  })

  describe('pergunta', () => {
    it('mostra título, descrição e as três opções como rádios de mesmo tamanho', () => {
      const html = render()
      expect(html).toContain('role="dialog"')
      expect(html).toContain('aria-modal="true"')
      expect(html).toContain('Ganhe um badge da sua escolha no segundo turno:')
      expect(html).toContain('A escolha é definitiva.')
      for (const rotulo of ['>L<', '>22<', '>Nulo<']) expect(html).toContain(rotulo)
      expect(html).not.toContain('Prefiro não dizer')
      expect(html.match(/type="radio"/g)?.length).toBe(3)
    })

    it('a pergunta não marca foco: começa na primeira opção', () => {
      expect(render()).not.toContain('data-autofocus')
    })

    it('é obrigatório: sem botão de fechar', () => {
      expect(render()).not.toContain('aria-label="Fechar"')
    })

    it('"Continuar" só habilita com uma opção marcada', () => {
      expect(render()).toMatch(/<button[^>]*disabled=""[^>]*>Continuar/)
      estado({ selecao: 'l' })
      const html = render()
      expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Continuar/)
      expect(html).toMatch(/checked=""[^>]*value="l"/)
    })

    it('em 360 px as opções empilham, o cartão não passa da tela e os alvos têm 44 px', () => {
      const html = render()
      expect(html).toContain('w-full')
      expect(html).toContain('max-w-sm')
      expect(html).toContain('min-h-11')
      expect(html).toContain('overflow-y-auto')
    })
  })

  describe('confirmação', () => {
    it('repete a opção e avisa que é definitivo, com Confirmar e Voltar', () => {
      estado({ etapa: 'confirmacao', selecao: '22' })
      const html = render()
      expect(html).toContain('Confirmar: 22?')
      expect(html).toContain('Não dá para mudar depois.')
      expect(html).toMatch(/>Confirmar</)
      expect(html).toMatch(/>Voltar</)
      expect(html).not.toContain('aria-label="Fechar"')
    })

    it('o foco inicial é o Voltar (o menos destrutivo), com Confirmar primeiro na ordem', () => {
      estado({ etapa: 'confirmacao', selecao: 'l' })
      const html = render()
      expect(html.match(/data-autofocus/g)?.length).toBe(1)
      expect(html).toMatch(/<button[^>]*data-autofocus="true"[^>]*>Voltar/)
      expect(html.indexOf('>Confirmar<')).toBeLessThan(html.indexOf('>Voltar<'))
    })

    it('enquanto envia, desabilita Confirmar e Voltar', () => {
      estado({ etapa: 'confirmacao', selecao: 'l', enviando: true })
      expect(render().match(/disabled=""/g)?.length).toBe(2)
    })

    it('mostra o erro de envio (e só nesse caso)', () => {
      estado({ etapa: 'confirmacao', selecao: 'l' })
      expect(render()).not.toContain('role="alert"')
      estado({ etapa: 'confirmacao', selecao: 'l', erro: true })
      const html = render()
      expect(html).toContain('role="alert"')
      expect(html).toContain('Não foi possível enviar. Tente de novo.')
    })
  })

  describe('reações', () => {
    it('celebração: badge grande, nome do badge e pode fechar', () => {
      estado({ pendentes: [], reacao: { tipo: 'celebracao', badge: 'v22', rotulo: 'Fez o 22' } })
      const html = render()
      expect(html).toContain('Badge conquistado!')
      expect(html).toContain('Fez o 22')
      expect(html).toContain('enquete-badge')
      expect(html).toContain('width:224px')
      expect(html).toContain('aria-label="Fechar"')
    })

    it('celebração do Nulo: badge épico com o nome Votou Nulo', () => {
      estado({ pendentes: [], reacao: { tipo: 'celebracao', badge: 'nulo', rotulo: 'Votou Nulo' } })
      const html = render()
      expect(html).toContain('Votou Nulo')
      expect(html).toContain('#c38bff')
    })

    it('aviso neutro: sem animação de celebração e com Fechar', () => {
      estado({ pendentes: [], reacao: { tipo: 'neutra' } })
      const html = render()
      expect(html).toContain('Tudo certo! Sua escolha foi guardada.')
      expect(html).not.toContain('enquete-badge')
      expect(html).toMatch(/>Fechar</)
    })
  })

  describe('host', () => {
    it('sem pendentes e sem reação: nada na tela', () => {
      estado({ pendentes: [] })
      expect(render()).toBe('')
    })
  })
})
