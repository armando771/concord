import { describe, expect, it } from 'vitest'
import { voiceStatusView } from './ttsVoiceStatus'

describe('voiceStatusView', () => {
  it('cada estado da voz baixada vira um texto curto', () => {
    expect(voiceStatusView({ status: 'idle' })).toEqual({
      text: 'A voz de leitura (cerca de 90 MB) é baixada na primeira mensagem /tts.',
      warning: false,
      retry: false
    })
    expect(voiceStatusView({ status: 'downloading', percent: 42 }).text).toBe(
      'Baixando a voz de leitura… 42%'
    )
    expect(voiceStatusView({ status: 'ready' }).text).toBe('Voz de leitura pronta.')
  })

  it('erro avisa e oferece "Tentar de novo"', () => {
    expect(voiceStatusView({ status: 'error' })).toEqual({
      text: 'Não deu para baixar a voz de leitura: as mensagens /tts aparecem só no chat.',
      warning: true,
      retry: true
    })
  })

  it('processador sem voz: avisa, sem botão', () => {
    expect(voiceStatusView({ status: 'unsupported' })).toMatchObject({
      warning: true,
      retry: false
    })
  })
})
