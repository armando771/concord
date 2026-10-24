import { generateKeyPairSync, sign } from 'crypto'
import { describe, expect, it } from 'vitest'
import { verifyInstaller } from './updateSignature'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
const installer = Buffer.from('MZ… instalador do Concord 0.2.0')
const signature = sign(null, installer, privateKey).toString('base64')

describe('verifyInstaller', () => {
  it('aceita o instalador assinado pela chave do dono', () => {
    expect(verifyInstaller(installer, signature, publicPem)).toBe(true)
  })

  it('recusa um instalador adulterado', () => {
    const tampered = Buffer.concat([installer, Buffer.from('malware')])
    expect(verifyInstaller(tampered, signature, publicPem)).toBe(false)
  })

  it('recusa assinatura de outra chave', () => {
    const other = generateKeyPairSync('ed25519').privateKey
    const forged = sign(null, installer, other).toString('base64')
    expect(verifyInstaller(installer, forged, publicPem)).toBe(false)
  })

  it('recusa assinatura vazia, lixo ou sem chave configurada', () => {
    expect(verifyInstaller(installer, '', publicPem)).toBe(false)
    expect(verifyInstaller(installer, 'não-é-base64!!', publicPem)).toBe(false)
    expect(verifyInstaller(installer, signature, '')).toBe(false)
    expect(verifyInstaller(installer, signature, 'chave inválida')).toBe(false)
  })
})
