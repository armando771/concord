import { describe, expect, it } from 'vitest'
import { spawnSmtcPowerShell } from './smtcPowerShell'
import { smtcSources } from './smtcSources'

describe('smtcSources', () => {
  it('usa o helper só quando o exe existe; o PowerShell fica de reserva', () => {
    expect(smtcSources(__filename).helper).toBeTypeOf('function')
    expect(smtcSources('/nao/existe/concord-audio.exe').helper).toBeNull()
    expect(smtcSources(null).helper).toBeNull()
    expect(smtcSources(null).powershell).toBe(spawnSmtcPowerShell)
  })
})
