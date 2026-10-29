import { fireEvent, render, screen } from '@testing-library/react-native'
import type { Message } from '../api/messages'
import { MessageList } from './MessageList'

const msg = (id: string, minute: number): Message => ({
  id,
  author_id: 'u1',
  author: { id: 'u1', username: 'ana', display_name: 'Ana' },
  content: `texto ${id}`,
  created_at: `2026-10-28T10:${String(minute).padStart(2, '0')}:00Z`
})
const base = { hasMore: false, onLoadMore: () => {}, onRetry: () => {} }

describe('MessageList', () => {
  it('carregando: mostra o aviso', async () => {
    await render(<MessageList {...base} messages={[]} status="loading" />)
    expect(screen.getByText('Carregando mensagens…')).toBeOnTheScreen()
  })

  it('erro: mostra o aviso e tentar de novo', async () => {
    const onRetry = jest.fn()
    await render(<MessageList {...base} messages={[]} status="error" onRetry={onRetry} />)
    expect(screen.getByText('Não foi possível carregar as mensagens.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('canal vazio: mostra o convite', async () => {
    await render(<MessageList {...base} messages={[]} status="ready" />)
    expect(screen.getByText('Ainda não há mensagens aqui.')).toBeOnTheScreen()
  })

  it('com mensagens: mostra o texto de cada uma', async () => {
    await render(<MessageList {...base} messages={[msg('b', 2), msg('a', 1)]} status="ready" />)
    expect(screen.getByText('texto a')).toBeOnTheScreen()
    expect(screen.getByText('texto b')).toBeOnTheScreen()
  })
})
