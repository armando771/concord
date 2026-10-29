import { render, screen } from '@testing-library/react-native'
import { PresenceDot } from './PresenceDot'

describe('PresenceDot', () => {
  it.each([
    ['online', 'Online'],
    ['idle', 'Ausente'],
    ['dnd', 'Não perturbe'],
    ['offline', 'Offline']
  ] as const)('%s é anunciado como "%s"', async (status, label) => {
    await render(<PresenceDot status={status} />)
    expect(screen.getByLabelText(label)).toBeOnTheScreen()
  })

  it('o recorte da bolinha pode ter a cor do fundo de quem a mostra', async () => {
    await render(<PresenceDot status="online" cutout="#112233" />)
    expect(screen.getByLabelText('Online')).toHaveStyle({ borderColor: '#112233' })
  })

  it('sem status conhecido: offline', async () => {
    await render(<PresenceDot status={undefined} />)
    expect(screen.getByLabelText('Offline')).toBeOnTheScreen()
  })
})
