import { render } from '@testing-library/react-native'
import { KeyboardAvoidingView } from 'react-native'
import { ChatScreen } from './ChatScreen'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 48, bottom: 24, left: 0, right: 0 })
}))
jest.mock('../hooks/useChannelMessages', () => ({
  useChannelMessages: () => ({
    messages: [],
    status: 'ready',
    hasMore: false,
    loadMore: jest.fn(),
    send: jest.fn(),
    retry: jest.fn()
  })
}))

// Regressão: o chat fica abaixo do paddingTop (área segura) do layout; o KeyboardAvoidingView mede
// a posição relativa ao pai e subestimava o deslocamento: o campo de envio ficava atrás do teclado.
describe('ChatScreen', () => {
  it('compensa a área segura do topo no deslocamento do teclado', async () => {
    const screen = await render(<ChatScreen channelId="c1" channelName="geral" onBack={() => {}} />)
    const avoiding = screen.UNSAFE_getByType(KeyboardAvoidingView)
    expect(avoiding.props.keyboardVerticalOffset).toBe(48)
  })
})
