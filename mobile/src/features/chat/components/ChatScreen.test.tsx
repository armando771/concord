import { render, screen } from '@testing-library/react-native'
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
const mockUseRoomMessages = jest.fn()
jest.mock('../hooks/useRoomMessages', () => ({
  useRoomMessages: (target: unknown) => {
    mockUseRoomMessages(target)
    return { messages: [], status: 'ready', hasMore: false, loadMore: jest.fn(), send: jest.fn(), retry: jest.fn() }
  }
}))

describe('ChatScreen', () => {
  beforeEach(() => jest.clearAllMocks())

  // Regressão: o chat fica abaixo do paddingTop (área segura) do layout; o KeyboardAvoidingView mede
  // a posição relativa ao pai e subestimava o deslocamento: o campo de envio ficava atrás do teclado.
  it('compensa a área segura do topo no deslocamento do teclado', async () => {
    await render(<ChatScreen variant="channel" id="c1" title="geral" onBack={() => {}} />)
    expect(mockKeyboardAvoidingView).toHaveBeenCalledWith(expect.objectContaining({ keyboardVerticalOffset: 48 }))
  })

  it('canal: histórico do canal, # no topo e campo "Mensagem para #nome"', async () => {
    await render(<ChatScreen variant="channel" id="c1" title="geral" onBack={() => {}} />)
    expect(mockUseRoomMessages).toHaveBeenCalledWith({ kind: 'channel', id: 'c1' })
    expect(screen.getByText('#')).toBeOnTheScreen()
    expect(screen.getByLabelText('Mensagem para #geral')).toBeOnTheScreen()
  })

  it('DM 1 a 1: conversa, @ no topo e campo "Mensagem para @nome"', async () => {
    await render(<ChatScreen variant="dm" id="d1" title="Paulo" onBack={() => {}} />)
    expect(mockUseRoomMessages).toHaveBeenCalledWith({ kind: 'conversation', id: 'd1' })
    expect(screen.getByText('@')).toBeOnTheScreen()
    expect(screen.getByLabelText('Mensagem para @Paulo')).toBeOnTheScreen()
  })

  it('grupo: sem prefixo e campo "Mensagem para o grupo"', async () => {
    await render(<ChatScreen variant="group" id="g1" title="DEVS" onBack={() => {}} />)
    expect(mockUseRoomMessages).toHaveBeenCalledWith({ kind: 'conversation', id: 'g1' })
    expect(screen.queryByText('#')).toBeNull()
    expect(screen.queryByText('@')).toBeNull()
    expect(screen.getByLabelText('Mensagem para o grupo')).toBeOnTheScreen()
  })
})
