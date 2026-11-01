// Extração de .tar.gz no main (atualização do Linux, voz do /tts no Linux).
import { spawn } from 'child_process'
import type { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'

/** Extrai o .tar.gz (gunzip aqui; o tar do sistema só desempacota). */
export async function extractTarGz(source: Readable, dest: string): Promise<void> {
  const tar = spawn('tar', ['-x', '--no-same-owner', '-f', '-', '-C', dest], {
    stdio: ['pipe', 'ignore', 'pipe']
  })
  let stderr = ''
  tar.stderr.on('data', (chunk) => (stderr += chunk))
  const exited = new Promise<void>((resolve, reject) => {
    tar.on('error', reject)
    tar.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`tar saiu com ${code}: ${stderr.trim()}`))
    )
  })
  // Erro no gunzip derruba o pipe; espera o tar sair para não deixar processo.
  const piped = pipeline(source, createGunzip(), tar.stdin)
  const results = await Promise.allSettled([piped, exited])
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (failed) throw failed.reason
}
