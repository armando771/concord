import { render, screen } from '@testing-library/react-native'
import { NO_VOICE } from '../lib/callTypes'
import { ParticipantTile } from './ParticipantTile'

const ana = { id: 'u1', username: 'ana', display_name: 'Ana' }

describe('ParticipantTile', () => {
  it('mostra o nome e descreve o estado para o leitor de tela', async () => {
    await render(<ParticipantTile user={ana} speaking={false} voice={NO_VOICE} />)
    expect(screen.getByText('Ana')).toBeOnTheScreen()
    expect(screen.getByLabelText('Ana')).toBeOnTheScreen()
  })

  it('falando', async () => {
    await render(<ParticipantTile user={ana} speaking voice={NO_VOICE} />)
    expect(screen.getByLabelText('Ana, falando')).toBeOnTheScreen()
  })

  it('mudo e ensurdecido (inclusive por moderador)', async () => {
    await render(<ParticipantTile user={ana} speaking={false} voice={{ ...NO_VOICE, muted: true }} />)
    expect(screen.getByLabelText('Ana, mudo')).toBeOnTheScreen()
    await render(<ParticipantTile user={{ ...ana, id: 'u2', display_name: 'Bia' }} speaking={false} voice={{ ...NO_VOICE, serverDeafened: true }} />)
    expect(screen.getByLabelText('Bia, ensurdecido')).toBeOnTheScreen()
  })
})
