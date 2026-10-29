import { DEFAULT_SERVER_URL, deriveServerUrls } from './serverUrl'

describe('deriveServerUrls', () => {
  it('usa o servidor local quando não há endereço', () => {
    expect(deriveServerUrls(undefined)).toEqual({
      apiBaseUrl: `${DEFAULT_SERVER_URL}/api`,
      wsUrl: 'ws://localhost:8080/ws',
      liveKitUrl: 'ws://localhost:8080'
    })
  })

  it('https vira wss e a API fica em /api', () => {
    expect(deriveServerUrls('https://salinha.exemplo.com/')).toEqual({
      apiBaseUrl: 'https://salinha.exemplo.com/api',
      wsUrl: 'wss://salinha.exemplo.com/ws',
      liveKitUrl: 'wss://salinha.exemplo.com'
    })
  })

  it('mantém a porta e ignora espaços', () => {
    expect(deriveServerUrls('  http://192.168.0.10:8090 ')).toEqual({
      apiBaseUrl: 'http://192.168.0.10:8090/api',
      wsUrl: 'ws://192.168.0.10:8090/ws',
      liveKitUrl: 'ws://192.168.0.10:8090'
    })
  })
})
