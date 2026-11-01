import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { ProfileTap } from './ProfileTap'

describe('ProfileTap', () => {
  it('com id e onOpen: tocar abre o perfil daquela pessoa', async () => {
    const onOpen = jest.fn()
    await render(
      <ProfileTap userId="u1" label="Ana" onOpen={onOpen}>
        <Text>Ana</Text>
      </ProfileTap>
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Ana' }))
    expect(onOpen).toHaveBeenCalledWith('u1')
  })

  it('a área de toque passa de 44 dp mesmo em conteúdo pequeno (nome em texto)', async () => {
    await render(
      <ProfileTap userId="u1" label="Ana" onOpen={jest.fn()}>
        <Text>Ana</Text>
      </ProfileTap>
    )
    const { top, bottom } = screen.getByRole('button', { name: 'Ana' }).props.hitSlop
    expect(top + bottom + 18).toBeGreaterThanOrEqual(44)
  })

  it('sem onOpen ou sem id: só mostra o conteúdo, sem botão', async () => {
    await render(
      <>
        <ProfileTap userId="u1" label="A">
          <Text>sem handler</Text>
        </ProfileTap>
        <ProfileTap userId={undefined} label="B" onOpen={jest.fn()}>
          <Text>sem id</Text>
        </ProfileTap>
      </>
    )
    expect(screen.getByText('sem handler')).toBeOnTheScreen()
    expect(screen.getByText('sem id')).toBeOnTheScreen()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
