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

  it('sem status conhecido: offline', async () => {
    await render(<PresenceDot status={undefined} />)
    expect(screen.getByLabelText('Offline')).toBeOnTheScreen()
  })
})
