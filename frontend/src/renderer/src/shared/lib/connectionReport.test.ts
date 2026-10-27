import { describe, expect, it } from 'vitest'
import { connectionReport, detailsText, probeHint } from './connectionReport'
import type { ServerDiagnostics } from '../../../../shared/serverConnection'

const PRIMARY = 'https://74-0-5-252.sslip.io'
const FALLBACK = 'https://app-salinha.bhrx.com.br'
const NOW = new Date('2026-10-26T22:00:00.000Z')

const diag = (over: Partial<ServerDiagnostics> = {}): ServerDiagnostics => ({
  version: '0.6.9',
  server: PRIMARY,
  primary: PRIMARY,
  probes: [
    { url: PRIMARY, ok: false, detail: 'net::ERR_NAME_NOT_RESOLVED', ms: 12 },
    { url: FALLBACK, ok: false, detail: 'sem resposta em 6 s', ms: 6000 }
  ],
  ...over
})

describe('connectionReport', () => {
  it('junta versão, endereço, chat, internet, horário e o teste de cada endereço', () => {
    expect(
      connectionReport(diag(), { wsUrl: 'wss://74-0-5-252.sslip.io/ws', online: true, now: NOW })
    ).toEqual([
      'Salinha 0.6.9',
      'Servidor: https://74-0-5-252.sslip.io',
      'Chat: wss://74-0-5-252.sslip.io/ws',
      'Internet do sistema: ligada',
      'Horário do PC: 2026-10-26T22:00:00.000Z',
      'Teste de rede:',
      '- 74-0-5-252.sslip.io: falhou (net::ERR_NAME_NOT_RESOLVED, 12 ms) — o nome do servidor não foi encontrado (DNS, antivírus ou filtro da rede)',
      '- app-salinha.bhrx.com.br: falhou (sem resposta em 6 s, 6000 ms) — sem resposta (firewall, antivírus ou rede)'
    ])
  })

  it('diz quando o app está usando o endereço alternativo', () => {
    const lines = connectionReport(
      diag({ server: FALLBACK, probes: [{ url: FALLBACK, ok: true, detail: 'HTTP 200', ms: 80 }] }),
      { wsUrl: 'wss://app-salinha.bhrx.com.br/ws', online: false, now: NOW }
    )
    expect(lines).toContain('Servidor: https://app-salinha.bhrx.com.br (alternativo)')
    expect(lines).toContain('Internet do sistema: desligada')
    expect(lines).toContain('- app-salinha.bhrx.com.br: ok (HTTP 200, 80 ms)')
  })

  it('sem o teste do app (navegador, dev): só o que o renderer sabe', () => {
    expect(connectionReport(null, { wsUrl: 'ws://localhost:8080/ws', online: true, now: NOW })).toEqual([
      'Chat: ws://localhost:8080/ws',
      'Internet do sistema: ligada',
      'Horário do PC: 2026-10-26T22:00:00.000Z'
    ])
  })
})

describe('probeHint', () => {
  it.each([
    ['net::ERR_NAME_NOT_RESOLVED', 'o nome do servidor não foi encontrado'],
    ['net::ERR_CERT_DATE_INVALID', 'certificado recusado'],
    ['net::ERR_CERT_AUTHORITY_INVALID', 'certificado recusado'],
    ['net::ERR_CONNECTION_REFUSED', 'conexão recusada ou cortada'],
    ['net::ERR_CONNECTION_RESET', 'conexão recusada ou cortada'],
    ['net::ERR_CONNECTION_TIMED_OUT', 'sem resposta'],
    ['sem resposta em 6 s', 'sem resposta'],
    ['net::ERR_PROXY_CONNECTION_FAILED', 'proxy'],
    ['net::ERR_INTERNET_DISCONNECTED', 'sem internet']
  ])('%s → %s', (detail, hint) => {
    expect(probeHint(detail)).toContain(hint)
  })

  it('erro desconhecido: sem explicação (o código já vai no relatório)', () => {
    expect(probeHint('net::ERR_FAILED')).toBeNull()
  })
})

describe('detailsText', () => {
  const ctx = { wsUrl: 'wss://x/ws', online: true, now: NOW }

  it('antes do primeiro teste chegar: avisa que está testando', () => {
    expect(detailsText(null, true, ctx)).toBe('Testando a conexão…')
  })

  it('testando de novo: mantém o relatório anterior na tela', () => {
    expect(detailsText(diag(), true, ctx)).toContain('Salinha 0.6.9\n')
  })

  it('pronto: o relatório em linhas', () => {
    expect(detailsText(null, false, ctx)).toBe(
      'Chat: wss://x/ws\nInternet do sistema: ligada\nHorário do PC: 2026-10-26T22:00:00.000Z'
    )
  })
})
