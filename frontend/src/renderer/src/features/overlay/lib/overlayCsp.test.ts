import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fillCsp } from '../../../shared/lib/serverUrl'

// A janela do overlay carrega de outra origem que a API: sem a origem do servidor
// no img-src, avatares e GIFs não aparecem.
describe('CSP do overlay.html', () => {
  const html = readFileSync(join(process.cwd(), 'src/renderer/overlay.html'), 'utf8')

  it('deixa as imagens do servidor carregarem', () => {
    const filled = fillCsp(html, { connectSrc: "'self'", mediaSrc: "'self' blob: http://srv:8080" })
    expect(filled).toMatch(/img-src [^;"]*http:\/\/srv:8080/)
    expect(filled).not.toContain('%CONCORD_')
  })

  it('continua sem rede para scripts', () => {
    expect(html).toContain("connect-src 'none'")
  })
})
