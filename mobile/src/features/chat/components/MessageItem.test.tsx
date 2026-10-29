import { render, screen } from '@testing-library/react-native'
import type { Message } from '../api/messages'
import type { GroupedMessage } from '../lib/messageGroups'
import { MessageItem } from './MessageItem'

const message = (over: Partial<Message> = {}): Message => ({
  id: 'm1',
  author_id: 'u1',
  author: { id: 'u1', username: 'ana', display_name: 'Ana Mobile' },
  content: 'olá, pessoal',
  created_at: '2026-10-28T09:05:00Z',
  ...over
})
const item = (over: Partial<GroupedMessage> = {}, msg: Message = message()): GroupedMessage => ({
  message: msg,
  showHeader: true,
  dayLabel: null,
  ...over
})

describe('MessageItem', () => {
  it('primeira do bloco: nome, hora e texto', async () => {
    await render(<MessageItem item={item()} timeZone="UTC" />)
    expect(screen.getByText('Ana Mobile')).toBeOnTheScreen()
    expect(screen.getByText('09:05')).toBeOnTheScreen()
    expect(screen.getByText('olá, pessoal')).toBeOnTheScreen()
  })

  it('continuação do bloco: só o texto', async () => {
    await render(<MessageItem item={item({ showHeader: false })} timeZone="UTC" />)
    expect(screen.queryByText('Ana Mobile')).toBeNull()
    expect(screen.getByText('olá, pessoal')).toBeOnTheScreen()
  })

  it('abre um dia novo: mostra o separador por extenso', async () => {
    await render(<MessageItem item={item({ dayLabel: '2026-10-28' })} timeZone="UTC" />)
    expect(screen.getByText('28 de outubro de 2026')).toBeOnTheScreen()
  })

  it('mensagem editada leva o marcador do desktop', async () => {
    await render(<MessageItem item={item({}, message({ edited_at: '2026-10-28T09:10:00Z' }))} timeZone="UTC" />)
    expect(screen.getByText('(editada)')).toBeOnTheScreen()
  })

  it('só anexo/figurinha/GIF, sem texto: marcador de conteúdo não suportado', async () => {
    await render(<MessageItem item={item({}, message({ content: '', attachments: [{ id: 'a1' }] }))} timeZone="UTC" />)
    expect(screen.getByText('Anexo (ainda não aparece no app)')).toBeOnTheScreen()
  })

  it('autor ausente: não quebra', async () => {
    await render(<MessageItem item={item({}, message({ author: undefined }))} timeZone="UTC" />)
    expect(screen.getByText('olá, pessoal')).toBeOnTheScreen()
  })
})
