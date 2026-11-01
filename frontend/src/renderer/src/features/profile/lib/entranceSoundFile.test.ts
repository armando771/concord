import { describe, expect, it } from 'vitest'
import {
  MAX_ENTRANCE_SOUND_BYTES,
  entranceSoundDurationError,
  entranceSoundFileError,
  entranceSoundSaveError,
  entranceSoundStatus
} from './entranceSoundFile'

const file = (size: number, type = 'audio/mpeg', name = 'oi.mp3'): File => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('entranceSoundFileError', () => {
  it('aceita áudio pequeno (pelo tipo ou, sem tipo, pela extensão)', () => {
    expect(entranceSoundFileError(file(1000))).toBeNull()
    expect(entranceSoundFileError(file(1000, 'audio/ogg', 'a.ogg'))).toBeNull()
    expect(entranceSoundFileError(file(1000, '', 'a.m4a'))).toBeNull()
  })

  it('recusa o que não é áudio e o que passa de 2 MB', () => {
    expect(entranceSoundFileError(file(1000, 'image/png', 'a.png'))).toBe(
      'Use um áudio MP3, WAV, OGG, M4A ou WebM.'
    )
    expect(entranceSoundFileError(file(MAX_ENTRANCE_SOUND_BYTES + 1))).toBe(
      'O som de entrada pode ter até 2 MB.'
    )
  })
})

describe('entranceSoundDurationError', () => {
  it('entre 0,1 s e 5 s', () => {
    expect(entranceSoundDurationError(100)).toBeNull()
    expect(entranceSoundDurationError(5000)).toBeNull()
    for (const ms of [null, 0, 99, 5001, Number.NaN]) {
      expect(entranceSoundDurationError(ms)).toBe('O som de entrada precisa ter entre 0,1 s e 5 s.')
    }
  })
})

describe('entranceSoundSaveError', () => {
  it('status conhecido do servidor vira a regra em português', () => {
    expect(entranceSoundSaveError(new Error('file too large'), 413)).toBe(
      'O som de entrada pode ter até 2 MB.'
    )
    expect(entranceSoundSaveError(new Error('x'), 507)).toBe(
      'O servidor está sem espaço agora. Tente mais tarde.'
    )
  })

  it('o resto usa a mensagem do erro ou uma genérica', () => {
    expect(entranceSoundSaveError(new Error('Sem conexão com o servidor'), 0)).toBe(
      'Sem conexão com o servidor'
    )
    expect(entranceSoundSaveError('?')).toBe('Não foi possível salvar o som de entrada.')
  })
})

describe('entranceSoundStatus', () => {
  it('enviando/removendo primeiro; depois se o som é seu ou o padrão', () => {
    expect(entranceSoundStatus('upload', null)).toBe('Enviando…')
    expect(entranceSoundStatus('remove', '/x')).toBe('Removendo…')
    expect(entranceSoundStatus(null, '/x')).toBe('Usando o seu som.')
    expect(entranceSoundStatus(null, null)).toBe('Usando o som padrão.')
  })
})
