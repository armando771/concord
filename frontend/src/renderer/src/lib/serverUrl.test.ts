import { describe, expect, it } from 'vitest'
import { buildConnectSrc, buildMediaSrc, deriveServerUrls } from './serverUrl'

describe('deriveServerUrls', () => {
  it('deriva API, WebSocket e LiveKit de um endereço http', () => {
    expect(deriveServerUrls('http://abc.gl.at.ply.gg:12345')).toEqual({
      apiBaseUrl: 'http://abc.gl.at.ply.gg:12345/api',
      wsUrl: 'ws://abc.gl.at.ply.gg:12345/ws',
      liveKitUrl: 'ws://abc.gl.at.ply.gg:12345'
    })
  })

  it('usa wss quando o servidor é https (VPS com TLS)', () => {
    expect(deriveServerUrls('https://concord.exemplo.com.br/')).toEqual({
      apiBaseUrl: 'https://concord.exemplo.com.br/api',
      wsUrl: 'wss://concord.exemplo.com.br/ws',
      liveKitUrl: 'wss://concord.exemplo.com.br'
    })
  })

  it('cai no localhost:8080 quando não há endereço configurado', () => {
    expect(deriveServerUrls(undefined).apiBaseUrl).toBe('http://localhost:8080/api')
    expect(deriveServerUrls('').wsUrl).toBe('ws://localhost:8080/ws')
  })
})

describe('buildConnectSrc', () => {
  it('libera http e ws do servidor configurado', () => {
    expect(buildConnectSrc('http://abc.gl.at.ply.gg:12345')).toBe(
      "'self' http://abc.gl.at.ply.gg:12345 ws://abc.gl.at.ply.gg:12345"
    )
  })

  it('libera https e wss quando o servidor é https', () => {
    expect(buildConnectSrc('https://concord.exemplo.com.br')).toBe(
      "'self' https://concord.exemplo.com.br wss://concord.exemplo.com.br"
    )
  })
})

describe('buildMediaSrc', () => {
  it('libera blob e a origem do servidor', () => {
    expect(buildMediaSrc('http://abc.gl.at.ply.gg:12345')).toBe(
      "'self' blob: http://abc.gl.at.ply.gg:12345"
    )
    expect(buildMediaSrc('https://concord.exemplo.com.br/')).toBe(
      "'self' blob: https://concord.exemplo.com.br"
    )
  })
  it('usa o localhost:8080 sem endereço', () => {
    expect(buildMediaSrc(undefined)).toBe("'self' blob: http://localhost:8080")
  })
})
