// Baixa um arquivo da voz do /tts conferindo tamanho e sha256 fixos
// (piperAssets.ts). Nada é usado nem extraído antes de passar aqui.
import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import type { ReadableStream } from 'stream/web'
import type { PiperAsset } from './piperAssets'

export type Fetch = (url: string) => Promise<Response>

export async function downloadVerified(
  fetch: Fetch,
  asset: PiperAsset,
  dest: string,
  onBytes: (bytes: number) => void
): Promise<void> {
  const response = await fetch(asset.url)
  if (!response.ok || !response.body) throw new Error(`${asset.name}: HTTP ${response.status}`)
  const hash = createHash('sha256')
  let received = 0
  const check = new Transform({
    transform(chunk: Buffer, _enc, done) {
      received += chunk.length
      if (received > asset.size)
        return done(new Error(`${asset.name}: tamanho maior que o esperado`))
      hash.update(chunk)
      onBytes(chunk.length)
      done(null, chunk)
    }
  })
  await pipeline(Readable.fromWeb(response.body as ReadableStream), check, createWriteStream(dest))
  if (received !== asset.size) throw new Error(`${asset.name}: tamanho diferente do esperado`)
  if (hash.digest('hex') !== asset.sha256) throw new Error(`${asset.name}: sha256 não confere`)
}
