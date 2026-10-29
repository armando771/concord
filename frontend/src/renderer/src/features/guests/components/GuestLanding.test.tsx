import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuestPreviewState } from '../hooks/useGuestPreview'
import type { GuestJoin } from '../hooks/useGuestJoin'
import type { GuestCallPhase } from '../lib/guestCallPhase'

const preview: { current: GuestPreviewState } = { current: { status: 'loading' } }
vi.mock('../hooks/useGuestPreview', () => ({ useGuestPreview: () => preview.current }))
const join: { current: GuestJoin } = { current: null as never }
vi.mock('../hooks/useGuestJoin', () => ({ useGuestJoin: () => join.current }))
const call: { phase: GuestCallPhase } = { phase: 'connecting' }
vi.mock('../hooks/useGuestCall', () => ({
  useGuestCall: () => ({ phase: call.phase, rejoin: vi.fn() })
}))
vi.mock('../../auth/hooks/useSessionConnection', () => ({ useSessionConnection: () => {} }))
vi.mock('../../call/components/CallStage', () => ({ default: () => <div data-palco="" /> }))
vi.mock('../../call/components/ScreenSharePrompt', () => ({ default: () => null }))
vi.mock('../../call/hooks/useSpeaking', () => ({ default: () => new Set() }))
const callState = {
  muted: false,
  deafened: false,
  canSpeak: true,
  canStream: false,
  localCameraStream: null,
  isScreenSharing: false,
  participants: []
}
vi.mock('../../call/store/callStore', () => ({
  useCallStore: Object.assign((sel: (s: unknown) => unknown) => sel(callState), {
    getState: () => callState
  })
}))
vi.mock('../../../shared/ui/Modal', () => ({ default: () => null }))
// Render estático lê o estado inicial dos stores do zustand: a sessão é um fake.
const session = {
  link: null as string | null,
  pass: null as unknown,
  ended: null as string | null,
  anonymous: false,
  start(link: string, p: unknown, anonymous: boolean) {
    Object.assign(session, { link, pass: p, anonymous, ended: null })
  },
  end(reason: string) {
    session.ended = reason
  },
  clear() {
    Object.assign(session, { link: null, pass: null, ended: null, anonymous: false })
  }
}
vi.mock('../store/guestSessionStore', () => ({
  useGuestSessionStore: Object.assign((sel: (s: unknown) => unknown) => sel(session), {
    getState: () => session
  }),
  anonymousGuestLink: (s: typeof session) => (s.anonymous && s.link && !s.ended ? s.link : null)
}))

import GuestLanding from '../pages/GuestLanding'
import GuestSessionGate from './GuestSessionGate'
import GuestCallControls from './GuestCallControls'
import { useGuestSessionStore } from '../store/guestSessionStore'

const TOKEN = 'a'.repeat(43)
const pass = {
  server_id: 's',
  server_name: 'Salinha',
  channel_id: 'c',
  channel_name: 'Sala de jogos',
  expires_at: new Date(Date.now() + 3600_000 + 60_000).toISOString(),
  can_speak: true,
  can_stream: false
}

function render(path = `/visitante/${TOKEN}`): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/visitante/:token" element={<GuestLanding />} />
        <Route path="/" element={<div data-home="" />} />
      </Routes>
    </MemoryRouter>
  )
}

function joinState(over: Partial<GuestJoin> = {}): GuestJoin {
  return {
    withAccount: false,
    accountName: null,
    joining: false,
    error: null,
    join: vi.fn(),
    ...over
  }
}

describe('página do link de visitante', () => {
  beforeEach(() => {
    useGuestSessionStore.getState().clear()
    join.current = joinState()
  })

  it('token inválido volta para o início (sem cartão)', () => {
    expect(render('/visitante/curto')).not.toContain('Entrar')
  })

  it('carregando e link indisponível', () => {
    preview.current = { status: 'loading' }
    expect(render()).toContain('role="status"')
    preview.current = { status: 'error', message: 'Este link não existe mais.' }
    const html = render()
    expect(html).toContain('Link indisponível')
    expect(html).toContain('Ir para a Salinha')
  })

  it('sem conta: quem convidou, o lugar e o campo do nome', () => {
    preview.current = {
      status: 'ready',
      preview: {
        server_name: 'Salinha',
        channel_name: 'Sala',
        inviter_name: 'Bia',
        expires_at: pass.expires_at,
        can_speak: true,
        can_stream: false
      }
    }
    join.current = joinState({ error: 'O nome precisa ter de 2 a 32 caracteres.' })
    const html = render()
    expect(html).toContain('Bia convidou você para uma call')
    expect(html).toContain('Sala · Salinha')
    expect(html).toContain('Seu nome na call')
    expect(html).toContain('O nome precisa ter de 2 a 32 caracteres.')
    expect(html).toContain('Entrar na call')
  })

  it('com conta: entra com ela, sem pedir nome', () => {
    join.current = joinState({
      withAccount: true,
      accountName: 'Carla',
      error: 'Seu acesso de visitante foi encerrado.'
    })
    const html = render()
    expect(html).not.toContain('Seu nome na call')
    expect(html).toContain('Entrar como Carla')
    expect(html).toContain('role="alert"')
  })

  it('já dentro: só a call, com selo e tempo restante (sem canais nem chat)', () => {
    useGuestSessionStore.getState().start(TOKEN, pass, true)
    call.phase = 'active'
    const html = render()
    expect(html).toContain('Sala de jogos')
    expect(html).toContain('Visitante')
    expect(html).toContain('Acesso termina em 1 h')
    expect(html).toContain('data-palco')
    expect(html).toContain('Sair da call')
    expect(html).not.toContain('Canais')
  })

  it('saiu: oferece voltar; entrando: carregando', () => {
    useGuestSessionStore.getState().start(TOKEN, pass, true)
    call.phase = 'left'
    expect(render()).toContain('Voltar para a call')
    call.phase = 'connecting'
    expect(render()).toContain('role="status"')
  })

  it('acesso encerrado mostra o motivo', () => {
    useGuestSessionStore.getState().start(TOKEN, pass, false)
    useGuestSessionStore.getState().end('revoked')
    const html = render()
    expect(html).toContain('Seu acesso terminou')
    expect(html).toContain('O link de convite foi revogado.')
  })

  it('visitante sem conta não abre o resto do app', () => {
    useGuestSessionStore.getState().start(TOKEN, pass, true)
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <GuestSessionGate>
                <div data-app="" />
              </GuestSessionGate>
            }
          />
          <Route path="/visitante/:token" element={<div data-visitante="" />} />
        </Routes>
      </MemoryRouter>
    )
    expect(html).not.toContain('data-app')
    useGuestSessionStore.getState().clear()
    expect(
      renderToStaticMarkup(
        <MemoryRouter>
          <GuestSessionGate>
            <div data-app="" />
          </GuestSessionGate>
        </MemoryRouter>
      )
    ).toContain('data-app')
  })

  it('controles travam o que o convite não deu', () => {
    const html = renderToStaticMarkup(<GuestCallControls onVolumes={() => {}} />)
    expect(html).toMatch(/aria-label="Ligar câmera"[^>]*disabled=""/)
    expect(html).toMatch(/aria-label="Transmitir tela"[^>]*disabled=""/)
    expect(html).not.toMatch(/aria-label="Silenciar microfone"[^>]*disabled=""/)
    expect(html).toContain('Volume das pessoas')
  })
})
