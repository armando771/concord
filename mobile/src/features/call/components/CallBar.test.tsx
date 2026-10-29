import { fireEvent, render, screen } from '@testing-library/react-native'
import { useVoiceControlsStore } from '../../voice/store/voiceControlsStore'
import { useCallSessionStore } from '../store/callSessionStore'
import { CallBar } from './CallBar'

jest.mock('../../voice/store/voiceControlsStore', () => jest.requireActual('../../voice/store/voiceControlsStore'))
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn().mockResolvedValue(undefined) }))

beforeEach(() => {
  useCallSessionStore.getState().reset()
  useVoiceControlsStore.setState({ muted: false, deafened: false, mutedBeforeDeafen: false })
})

describe('CallBar', () => {
  it('sem chamada não aparece', async () => {
    await render(<CallBar onOpen={jest.fn()} onLeave={jest.fn()} />)
    expect(screen.queryByRole('button', { name: 'Sair da chamada' })).toBeNull()
  })

  it('mostra o canal e abre a tela cheia ao tocar', async () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', name: 'Geral' })
    const onOpen = jest.fn()
    await render(<CallBar onOpen={onOpen} onLeave={jest.fn()} />)
    expect(screen.getByText('Geral')).toBeOnTheScreen()
    expect(screen.getByText('Em chamada')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir chamada em Geral' }))
    expect(onOpen).toHaveBeenCalled()
  })

  it('mostra Conectando… enquanto entra', async () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'connecting', name: 'Geral' })
    await render(<CallBar onOpen={jest.fn()} onLeave={jest.fn()} />)
    expect(screen.getByText('Conectando…')).toBeOnTheScreen()
  })

  it('Sair chama a ação e o microfone alterna o mudo', async () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', name: 'Geral' })
    const onLeave = jest.fn()
    await render(<CallBar onOpen={jest.fn()} onLeave={onLeave} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Sair da chamada' }))
    expect(onLeave).toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'Silenciar microfone' }))
    expect(useVoiceControlsStore.getState().muted).toBe(true)
  })
})
