import { describe, expect, it } from 'vitest'
import { draftAfterSendFailure } from './composerDraft'

describe('draftAfterSendFailure', () => {
  it('campo ainda vazio: devolve o texto que não foi enviado', () => {
    expect(draftAfterSendFailure('oi gente', '')).toBe('oi gente')
  })

  it('só espaço digitado depois conta como nada novo', () => {
    expect(draftAfterSendFailure('oi gente', '  ')).toBe('oi gente')
  })

  it('a pessoa já digitou outra coisa: fica o texto novo', () => {
    expect(draftAfterSendFailure('oi gente', 'e aí')).toBeNull()
  })

  it('envio sem texto (só anexo) não tem o que devolver', () => {
    expect(draftAfterSendFailure('', '')).toBeNull()
    expect(draftAfterSendFailure('   ', '')).toBeNull()
  })
})
