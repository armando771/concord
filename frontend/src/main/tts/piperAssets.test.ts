import { describe, expect, it } from 'vitest'
import {
  PIPER_BUNDLE,
  piperAssetsFor,
  piperPaths,
  ttsDirsToPrune,
  TTS_STAGING_PREFIX
} from './piperAssets'

describe('piperAssetsFor', () => {
  it('x64 baixa o Piper x86_64 e a voz pt-BR', () => {
    const assets = piperAssetsFor('x64')!
    expect(assets.map((a) => a.name)).toEqual([
      'piper_linux_x86_64.tar.gz',
      'pt_BR-faber-medium.onnx',
      'pt_BR-faber-medium.onnx.json'
    ])
    expect(assets[0].extract).toBe(true)
  })

  it('arm64 baixa o Piper aarch64', () => {
    expect(piperAssetsFor('arm64')![0].name).toBe('piper_linux_aarch64.tar.gz')
  })

  it('outro processador não tem voz', () => {
    expect(piperAssetsFor('arm')).toBeNull()
    expect(piperAssetsFor('ia32')).toBeNull()
  })

  it('só fontes oficiais, por HTTPS, com sha256 e tamanho fixos', () => {
    for (const arch of ['x64', 'arm64']) {
      for (const a of piperAssetsFor(arch)!) {
        expect(a.url).toMatch(
          /^https:\/\/(github\.com\/rhasspy\/piper\/releases\/download\/|huggingface\.co\/rhasspy\/piper-voices\/resolve\/[0-9a-f]{40}\/)/
        )
        expect(a.sha256).toMatch(/^[0-9a-f]{64}$/)
        expect(a.size).toBeGreaterThan(0)
      }
    }
  })
})

describe('piperPaths', () => {
  it('binário e modelo dentro da pasta da versão', () => {
    expect(piperPaths('/d/tts/v1')).toEqual({
      binary: '/d/tts/v1/piper/piper',
      model: '/d/tts/v1/pt_BR-faber-medium.onnx'
    })
  })
})

describe('ttsDirsToPrune', () => {
  it('apaga versões antigas e extrações abandonadas, nunca a atual nem a deste processo', () => {
    const entries = [
      PIPER_BUNDLE,
      'velha-1',
      `${TTS_STAGING_PREFIX}${PIPER_BUNDLE}-10`,
      `${TTS_STAGING_PREFIX}${PIPER_BUNDLE}-42`
    ]
    expect(ttsDirsToPrune(entries, 42)).toEqual([
      'velha-1',
      `${TTS_STAGING_PREFIX}${PIPER_BUNDLE}-10`
    ])
  })
})
