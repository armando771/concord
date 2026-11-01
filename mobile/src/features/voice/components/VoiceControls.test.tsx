import { fireEvent, render, screen } from '@testing-library/react-native'
import { useVoiceControlsStore } from '../store/voiceControlsStore'
import { VoiceControls } from './VoiceControls'

jest.mock('expo-secure-store')

describe('VoiceControls', () => {
  beforeEach(() => useVoiceControlsStore.setState(useVoiceControlsStore.getInitialState(), true))

  it('microfone: alterna e anuncia a ação seguinte', async () => {
    await render(<VoiceControls />)
    await fireEvent.press(screen.getByRole('button', { name: 'Silenciar microfone' }))
    expect(useVoiceControlsStore.getState().muted).toBe(true)
    expect(screen.getByRole('button', { name: 'Ativar microfone' })).toBeOnTheScreen()
  })

  it('fone: ensurdecer também silencia o microfone', async () => {
    await render(<VoiceControls />)
    await fireEvent.press(screen.getByRole('button', { name: 'Ensurdecer' }))
    expect(useVoiceControlsStore.getState()).toMatchObject({ deafened: true, muted: true })
    expect(screen.getByRole('button', { name: 'Desensurdecer' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ativar microfone' })).toBeOnTheScreen()
  })
})
