import { fireEvent, render, screen } from '@testing-library/react-native'
import type { Channel } from '../api/channels'
import { ChannelList } from './ChannelList'

const ch = (id: string, name: string, type: 'text' | 'voice'): Channel => ({
  id,
  server_id: 's',
  name,
  type,
  created_by: 'u',
  created_at: '',
  updated_at: ''
})
const channels = [ch('t1', 'geral', 'text'), ch('v1', 'sala-1', 'voice')]
const base = { serverName: 'BH RX', error: false, onOpenChannel: () => {}, onRetry: () => {} }

describe('ChannelList', () => {
  it('mostra o servidor e as seções de texto e voz', async () => {
    await render(<ChannelList {...base} channels={channels} />)
    expect(screen.getByText('BH RX')).toBeOnTheScreen()
    expect(screen.getByText('Canais de texto')).toBeOnTheScreen()
    expect(screen.getByText('Canais de voz')).toBeOnTheScreen()
  })

  it('tocar num canal de texto abre ele', async () => {
    const onOpenChannel = jest.fn()
    await render(<ChannelList {...base} channels={channels} onOpenChannel={onOpenChannel} />)
    await fireEvent.press(screen.getByRole('button', { name: 'geral' }))
    expect(onOpenChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
  })

  it('tocar num canal de voz não abre: avisa que chega em breve', async () => {
    const onOpenChannel = jest.fn()
    await render(<ChannelList {...base} channels={channels} onOpenChannel={onOpenChannel} />)
    await fireEvent.press(screen.getByRole('button', { name: 'sala-1' }))
    expect(onOpenChannel).not.toHaveBeenCalled()
    expect(screen.getByText('Canais de voz chegam em breve')).toBeOnTheScreen()
  })

  it('falha ao carregar os canais: oferece tentar de novo', async () => {
    const onRetry = jest.fn()
    await render(<ChannelList {...base} channels={[]} error onRetry={onRetry} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
