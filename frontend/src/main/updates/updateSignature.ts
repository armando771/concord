import { createPublicKey, verify } from 'crypto'

/**
 * Confere a assinatura Ed25519 do instalador baixado. Como as atualizações
 * chegam por HTTP (túnel), o hash do latest.yml não protege contra quem está
 * no caminho — só a assinatura feita com a chave privada do dono protege.
 */
export function verifyInstaller(data: Buffer, signatureB64: string, publicKeyPem: string): boolean {
  if (!signatureB64 || !publicKeyPem) return false
  try {
    const signature = Buffer.from(signatureB64.trim(), 'base64')
    if (signature.length !== 64) return false
    return verify(null, data, createPublicKey(publicKeyPem), signature)
  } catch {
    return false
  }
}
