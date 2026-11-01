import { render, screen } from '@testing-library/react-native'
import { useNetworkStore } from '../store/networkStore'
import { OfflineBanner } from './OfflineBanner'

describe('OfflineBanner', () => {
  it('online: não mostra nada', async () => {
    useNetworkStore.setState({ online: true })
    await render(<OfflineBanner />)
    expect(screen.queryByText('Sem conexão')).toBeNull()
  })

  it('offline: mostra "Sem conexão"', async () => {
    useNetworkStore.setState({ online: false })
    await render(<OfflineBanner />)
    expect(screen.getByText('Sem conexão')).toBeOnTheScreen()
  })
})
