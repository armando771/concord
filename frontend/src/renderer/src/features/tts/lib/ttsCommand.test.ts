import { describe, expect, it } from 'vitest'
import { parseTTSCommand, ttsErrorMessage } from './ttsCommand'

describe('parseTTSCommand', () => {
  it('pega o texto depois de /tts', () => {
    expect(parseTTSCommand('/tts bom dia gente')).toBe('bom dia gente')
    expect(parseTTSCommand('  /TTS   oi  ')).toBe('oi')
  })
  it('/tts sozinho é o comando sem texto', () => {
    expect(parseTTSCommand('/tts')).toBe('')
    expect(parseTTSCommand('/tts   ')).toBe('')
  })
  it('não confunde com outra coisa', () => {
    expect(parseTTSCommand('/ttsx oi')).toBeNull()
    expect(parseTTSCommand('oi /tts oi')).toBeNull()
    expect(parseTTSCommand('/play oi')).toBeNull()
  })
})

describe('ttsErrorMessage', () => {
  it('intervalo diz quanto falta', () => {
    expect(ttsErrorMessage('tts_cooldown', { retry_after: 7 })).toBe(
      'Espere 7 s para mandar outra mensagem TTS.'
    )
  })
  it('texto longo e vazio', () => {
    expect(ttsErrorMessage('tts_too_long', {})).toBe(
      'A mensagem TTS pode ter no máximo 200 caracteres.'
    )
    expect(ttsErrorMessage('content_required', {})).toBe('Escreva o que falar depois de /tts.')
  })
  it('outros erros ficam com quem chama', () => {
    expect(ttsErrorMessage('missing_permission', {})).toBeNull()
    expect(ttsErrorMessage(undefined, {})).toBeNull()
  })
})
