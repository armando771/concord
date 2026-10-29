import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useNetworkStore } from '../../../shared/store/networkStore'
import type { SendOutcome } from '../hooks/useRoomMessages'
import { Composer } from './Composer'

const type = (text: string) => fireEvent.changeText(screen.getByLabelText('Mensagem para #geral'), text)
const press = () => fireEvent.press(screen.getByRole('button', { name: 'Enviar' }))
const FORBIDDEN = 'Você não tem permissão para enviar mensagens neste canal.'
const setup = (onSend: (t: string) => Promise<SendOutcome>, forbiddenNotice: string | null = FORBIDDEN) =>
  render(<Composer label="Mensagem para #geral" onSend={onSend} forbiddenNotice={forbiddenNotice ?? undefined} />)

describe('Composer', () => {
  beforeEach(() => useNetworkStore.setState({ online: true }))

  it('enviar chama onSend com o texto e limpa o campo', async () => {
    const onSend = jest.fn().mockResolvedValue('ok')
    await setup(onSend)
    await type('oi')
    await press()
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('oi'))
    await waitFor(() => expect(screen.getByLabelText('Mensagem para #geral').props.value).toBe(''))
  })

  it('campo vazio: botão desativado', async () => {
    await setup(jest.fn())
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    await type('   ')
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('falha: o texto volta ao campo e aparece o aviso', async () => {
    await setup(jest.fn().mockResolvedValue('error'))
    await type('oi')
    await press()
    expect(await screen.findByText('Não foi possível enviar. Tente de novo.')).toBeOnTheScreen()
    expect(screen.getByLabelText('Mensagem para #geral').props.value).toBe('oi')
  })

  it('403: aviso de permissão', async () => {
    await setup(jest.fn().mockResolvedValue('forbidden'))
    await type('oi')
    await press()
    expect(await screen.findByText('Você não tem permissão para enviar mensagens neste canal.')).toBeOnTheScreen()
  })

  it('403 sem texto próprio (DM): cai no aviso genérico de falha', async () => {
    await setup(jest.fn().mockResolvedValue('forbidden'), null)
    await type('oi')
    await press()
    expect(await screen.findByText('Não foi possível enviar. Tente de novo.')).toBeOnTheScreen()
  })

  it('sem rede: botão desativado mesmo com texto', async () => {
    useNetworkStore.setState({ online: false })
    await setup(jest.fn())
    await type('oi')
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('durante o envio o botão fica desativado (sem envio duplo)', async () => {
    let finish: (o: SendOutcome) => void = () => {}
    const onSend = jest.fn().mockReturnValue(new Promise((r) => (finish = r)))
    await setup(onSend)
    await type('oi')
    const pressing = press()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled())
    finish('ok')
    await pressing
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})
