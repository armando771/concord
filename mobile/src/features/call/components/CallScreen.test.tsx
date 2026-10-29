import { fireEvent, render, screen } from '@testing-library/react-native'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallSessionStore } from '../store/callSessionStore'
import { useParticipantsStore } from '../store/participantsStore'
import { useSpeakingStore } from '../store/speakingStore'
import { CallScreen } from './CallScreen'

const ana = { id: 'u1', username: 'ana', display_name: 'Ana' }

beforeEach(() => {
  useCallSessionStore.getState().reset()
  useParticipantsStore.getState().reset()
  useSpeakingStore.getState().reset()
  useAuthStore.setState({ status: 'signedIn', user: { id: 'me', username: 'eu', display_name: 'Eu', email: 'e@e.co' } })
  useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', channelId: 'ch1', name: 'Geral' })
})

describe('CallScreen', () => {
  it('mostra o canal, eu e os participantes', async () => {
    useParticipantsStore.getState().upsert(ana)
    await render(<CallScreen onBack={jest.fn()} onLeave={jest.fn()} />)
    expect(screen.getByText('Geral')).toBeOnTheScreen()
    expect(screen.getByText('Eu')).toBeOnTheScreen()
    expect(screen.getByText('Ana')).toBeOnTheScreen()
  })

  it('quem fala aparece em destaque', async () => {
    useParticipantsStore.getState().upsert(ana)
    useSpeakingStore.getState().set(['u1'])
    await render(<CallScreen onBack={jest.fn()} onLeave={jest.fn()} />)
    expect(screen.getByLabelText('Ana, falando')).toBeOnTheScreen()
  })

  it('mostra o estado da conexão', async () => {
    useCallSessionStore.getState().setPhase('reconnecting')
    await render(<CallScreen onBack={jest.fn()} onLeave={jest.fn()} />)
    expect(screen.getByText('Reconectando…')).toBeOnTheScreen()
  })

  it('Sair da chamada e Minimizar chamam as ações', async () => {
    const onBack = jest.fn()
    const onLeave = jest.fn()
    await render(<CallScreen onBack={onBack} onLeave={onLeave} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Sair da chamada' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Minimizar chamada' }))
    expect(onLeave).toHaveBeenCalled()
    expect(onBack).toHaveBeenCalled()
  })

  it('tem os botões de microfone e fone', async () => {
    await render(<CallScreen onBack={jest.fn()} onLeave={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Silenciar microfone' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ensurdecer' })).toBeOnTheScreen()
  })
})
