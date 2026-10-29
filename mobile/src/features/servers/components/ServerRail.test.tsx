import { fireEvent, render, screen } from '@testing-library/react-native'
import type { Server } from '../api/servers'
import { ServerRail } from './ServerRail'

const servers: Server[] = [
  { id: 's1', name: 'BH RX', owner_id: 'u' },
  { id: 's2', name: 'Stations', owner_id: 'u' }
]

describe('ServerRail', () => {
  it('mostra as DMs no topo e um botão por servidor', async () => {
    await render(<ServerRail servers={servers} selectedId={null} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Mensagens diretas' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'BH RX' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Stations' })).toBeOnTheScreen()
  })

  it('tocar num servidor seleciona ele; tocar nas DMs seleciona null', async () => {
    const onSelect = jest.fn()
    await render(<ServerRail servers={servers} selectedId="s1" onSelect={onSelect} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Stations' }))
    expect(onSelect).toHaveBeenLastCalledWith('s2')
    await fireEvent.press(screen.getByRole('button', { name: 'Mensagens diretas' }))
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })

  it('anuncia qual está selecionado', async () => {
    await render(<ServerRail servers={servers} selectedId="s2" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Stations' })).toBeSelected()
    expect(screen.getByRole('button', { name: 'BH RX' })).not.toBeSelected()
  })
})
