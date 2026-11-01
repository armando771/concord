import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { callState } = vi.hoisted(() => ({
  callState: {
    status: 'idle',
    type: null as string | null,
    channelId: null as string | null,
    serverId: null as string | null
  }
}))
vi.mock('../../call/store/callStore', () => ({
  useCallStore: Object.assign((sel: (s: unknown) => unknown) => sel(callState), {
    getState: () => callState
  })
}))
vi.mock('../../call/components/CallStage', () => ({ default: () => <div data-palco="" /> }))
vi.mock('../../call/components/CallControlsDock', () => ({ default: () => <div data-dock="" /> }))
vi.mock('../../call/hooks/useSpeaking', () => ({ default: () => new Set() }))
vi.mock('../../../app/SidebarFooter', () => ({ default: () => <div data-rodape="" /> }))
vi.mock('../../../shared/hooks/useResizableWidth', () => ({
  useResizableWidth: () => ({ width: 240, panelStyle: {}, handleProps: {} })
}))
vi.mock('../../../shared/ui/ResizeHandle', () => ({ default: () => null }))
// Render estático lê o estado inicial do zustand: as visitas são um fake.
const { visitsState } = vi.hoisted(() => ({
  visitsState: { visits: [] as Array<Record<string, unknown>>, loaded: false }
}))
vi.mock('../store/guestVisitsStore', () => ({
  useGuestVisitsStore: Object.assign((sel: (s: unknown) => unknown) => sel(visitsState), {
    getState: () => ({
      reset: () => Object.assign(visitsState, { visits: [], loaded: false }),
      set: (visits: Array<Record<string, unknown>>) =>
        Object.assign(visitsState, { visits, loaded: true })
    })
  })
}))
vi.mock('../hooks/useGuestVisits', async () => {
  const lib = await import('../lib/guestVisits')
  return {
    useLiveVisits: () => lib.liveVisits(visitsState.visits as never[], Date.now()),
    useVisit: (id?: string | null) =>
      lib.visitOf(visitsState.visits as never[], id ?? undefined, Date.now())
  }
})
const join = { joining: false, error: null as string | null, join: vi.fn() }
vi.mock('../hooks/useGuestVisitJoin', () => ({
  useGuestVisitJoin: () => join,
  enterVisitCall: vi.fn()
}))

import GuestVisitsRail from './GuestVisitsRail'
import GuestVisitView from './GuestVisitView'
import GuestVisitSidebar from './GuestVisitSidebar'
import GuestVisitRedirect from './GuestVisitRedirect'
import { ConfirmBody } from './GuestVisitConfirmModal'
import GuestVisitPage from '../pages/GuestVisitPage'
import { useGuestVisitsStore } from '../store/guestVisitsStore'

const visit = {
  server_id: 's',
  server_name: 'BH RX',
  server_icon_url: null,
  channel_id: 'c',
  channel_name: 'Resenha',
  expires_at: new Date(Date.now() + 2 * 3600_000 - 60_000).toISOString(),
  can_speak: true,
  can_stream: true
}

function at(path: string, routes: React.ReactNode): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{routes}</Routes>
    </MemoryRouter>
  )
}

describe('visita de quem tem conta, dentro do app', () => {
  beforeEach(() => {
    useGuestVisitsStore.getState().reset()
    Object.assign(callState, { status: 'idle', type: null, channelId: null, serverId: null })
    join.error = null
  })

  it('o trilho mostra cada visita ativa com o selo; sem visita, nada', () => {
    expect(renderToStaticMarkup(<MemoryRouter><GuestVisitsRail /></MemoryRouter>)).toBe('')
    useGuestVisitsStore.getState().set([visit, { ...visit, server_id: 'x', server_name: 'Outro' }])
    const html = renderToStaticMarkup(<MemoryRouter><GuestVisitsRail /></MemoryRouter>)
    expect(html).toContain('Visitas')
    expect(html).toContain('aria-label="BH RX (visitante)"')
    expect(html).toContain('aria-label="Outro (visitante)"')
  })

  it('visita vencida some do trilho', () => {
    useGuestVisitsStore.getState().set([{ ...visit, expires_at: '2020-01-01T00:00:00Z' }])
    expect(renderToStaticMarkup(<MemoryRouter><GuestVisitsRail /></MemoryRouter>)).toBe('')
  })

  it('fora da call: entrar de novo, com o tempo que falta', () => {
    const html = renderToStaticMarkup(<GuestVisitView visit={visit} />)
    expect(html).toContain('Você é visitante em BH RX')
    expect(html).toContain('Só a call de #Resenha fica aberta para você.')
    expect(html).toContain('Acesso termina em 1 h')
    expect(html).toContain('Entrar na call')
    expect(html).not.toContain('data-palco')
  })

  it('na call: o palco e os controles de uma call comum', () => {
    Object.assign(callState, { status: 'active', type: 'channel', channelId: 'c', serverId: 's' })
    const html = renderToStaticMarkup(<GuestVisitView visit={visit} />)
    expect(html).toContain('data-palco')
    expect(html).toContain('data-dock')
    expect(html).toContain('Resenha')
    expect(html).toContain('Visitante')
    // Sem o X: quem tem conta navega pelo app.
    expect(html).not.toContain('Sair da call de visitante')
  })

  it('a barra lateral da visita mostra só o canal do convite e o rodapé', () => {
    useGuestVisitsStore.getState().set([visit])
    const html = at('/visitas/s', <Route path="/visitas/:serverId" element={<GuestVisitSidebar />} />)
    expect(html).toContain('BH RX')
    expect(html).toContain('Resenha')
    expect(html).toContain('Só a call do convite fica aberta para você.')
    expect(html).toContain('data-rodape')
  })

  it('a página da visita: espera a lista, abre a visita ou volta ao Início', () => {
    const routes = (
      <>
        <Route path="/visitas/:serverId" element={<GuestVisitPage />} />
        <Route path="/friends" element={<div data-inicio="" />} />
      </>
    )
    expect(at('/visitas/s', routes)).toContain('role="status"')
    useGuestVisitsStore.getState().set([visit])
    expect(at('/visitas/s', routes)).toContain('Você é visitante em BH RX')
    // Acabou: <Navigate> para o Início (no render estático, nada na tela).
    useGuestVisitsStore.getState().set([])
    expect(at('/visitas/s', routes)).toBe('')
  })

  it('a tela do servidor visitado (link do painel de voz) abre a visita', () => {
    const routes = (
      <>
        <Route
          path="/servers/:id/channels/:channelId"
          element={
            <GuestVisitRedirect>
              <div data-servidor="" />
            </GuestVisitRedirect>
          }
        />
        <Route path="/visitas/:serverId" element={<div data-visita="" />} />
      </>
    )
    expect(at('/servers/s/channels/c', routes)).toContain('data-servidor')
    // Visitante: <Navigate> para /visitas/s (no render estático, nada na tela).
    useGuestVisitsStore.getState().set([visit])
    expect(at('/servers/s/channels/c', routes)).toBe('')
  })

  it('a confirmação diz quem convidou, o que pode e oferece entrar ou agora não', () => {
    join.error = 'Este link já foi usado pelo número máximo de visitantes.'
    const html = renderToStaticMarkup(
      <ConfirmBody
        token="t"
        preview={{
          server_name: 'BH RX',
          channel_name: 'Resenha',
          inviter_name: 'Bia',
          expires_at: visit.expires_at,
          can_speak: true,
          can_stream: false
        }}
        onCancel={() => {}}
      />
    )
    expect(html).toContain('Bia convidou você.')
    expect(html).toContain('Você pode falar.')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Entrar na call')
    expect(html).toContain('Agora não')
  })
})
