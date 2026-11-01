import { describe, expect, it } from 'vitest'
import { encodePowerShell, SMTC_SCRIPT } from './smtcPowerShell'

describe('SMTC_SCRIPT', () => {
  it('encerra sozinho quando o app some e escreve em UTF-8', () => {
    const script = SMTC_SCRIPT(4242)
    expect(script).toContain('Get-Process -Id 4242')
    expect(script).toContain('UTF8Encoding')
    expect(script).toContain('GlobalSystemMediaTransportControlsSessionManager')
  })

  it('codifica em UTF-16LE base64 para o -EncodedCommand', () => {
    expect(Buffer.from(encodePowerShell('ok'), 'base64').toString('utf16le')).toBe('ok')
  })
})
