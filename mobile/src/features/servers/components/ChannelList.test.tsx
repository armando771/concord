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

  it('tocar num canal de voz entra na chamada em vez de abrir chat', async () => {
    const onOpenChannel = jest.fn()
    const onJoinVoice = jest.fn()
    await render(<ChannelList {...base} channels={channels} onOpenChannel={onOpenChannel} onJoinVoice={onJoinVoice} />)
    await fireEvent.press(screen.getByRole('button', { name: 'sala-1' }))
    expect(onOpenChannel).not.toHaveBeenCalled()
    expect(onJoinVoice).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1' }))
  })

  it('mostra embaixo do canal de voz quem está nele', async () => {
    const ana = { id: 'u1', username: 'ana', display_name: 'Ana' }
    await render(<ChannelList {...base} channels={channels} voiceMembers={{ v1: [ana] }} />)
    expect(screen.getByText('Ana')).toBeOnTheScreen()
  })

  it('canal com mensagem não lida ganha o ponto; os outros não', async () => {
    await render(<ChannelList {...base} channels={[ch('t1', 'geral', 'text'), ch('t2', 'avisos', 'text')]} unreadChannels={{ t2: 4 }} />)
    expect(screen.getAllByLabelText('Mensagens não lidas')).toHaveLength(1)
  })

  it('falha ao carregar os canais: oferece tentar de novo', async () => {
    const onRetry = jest.fn()
    await render(<ChannelList {...base} channels={[]} error onRetry={onRetry} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
