import { render } from '@testing-library/react-native'
import { ChatScreen } from './ChatScreen'

const mockKeyboardAvoidingView = jest.fn()
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const { createElement } = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: (props: { children: unknown }) => {
      mockKeyboardAvoidingView(props)
      return createElement(View, null, props.children)
    }
  }
})
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 48, bottom: 24, left: 0, right: 0 })
}))
jest.mock('../hooks/useRoomMessages', () => ({
  useRoomMessages: () => ({
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
    await render(<ChatScreen channelId="c1" channelName="geral" onBack={() => {}} />)
    expect(mockKeyboardAvoidingView).toHaveBeenCalledWith(expect.objectContaining({ keyboardVerticalOffset: 48 }))
  })
})
