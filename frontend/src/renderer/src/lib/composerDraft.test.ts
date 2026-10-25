import { describe, expect, it } from 'vitest'
import { afterSendFailure, restoreFailedText } from './composerDraft'

describe('afterSendFailure', () => {
  it('campo ainda vazio: devolve o texto (e a resposta) na hora', () => {
    expect(afterSendFailure('oi gente', false, '')).toBe('restore')
    expect(afterSendFailure('oi gente', true, '')).toBe('restore')
  })

  it('só espaço digitado depois conta como nada novo', () => {
    expect(afterSendFailure('oi gente', false, '  ')).toBe('restore')
  })

  it('a pessoa já digitou outra coisa: fica o novo e o aviso oferece restaurar', () => {
    expect(afterSendFailure('oi gente', false, 'e aí')).toBe('offer')
  })

  it('só anexo, respondendo alguém: a resposta também não se perde', () => {
    expect(afterSendFailure('', true, '')).toBe('restore')
    expect(afterSendFailure('', true, 'e aí')).toBe('offer')
  })

  it('só anexo, sem resposta: os anexos ficam no rascunho, nada a devolver', () => {
    expect(afterSendFailure('', false, '')).toBe('nothing')
    expect(afterSendFailure('   ', false, 'e aí')).toBe('nothing')
  })
})

describe('restoreFailedText', () => {
  it('põe o texto que falhou antes do que foi digitado depois', () => {
    expect(restoreFailedText('oi gente', 'e aí')).toBe('oi gente e aí')
  })

  it('não duplica espaços na emenda', () => {
    expect(restoreFailedText('oi gente ', '  e aí')).toBe('oi gente e aí')
  })

  it('campo vazio fica só com o que falhou; falhou sem texto mantém o atual', () => {
    expect(restoreFailedText('oi gente', '')).toBe('oi gente')
    expect(restoreFailedText('', 'e aí')).toBe('e aí')
  })
})
