import { describe, expect, it } from 'vitest'
import { chooseServer, probeServer, updateFeedFor, type ProbeFetch } from './serverChoice'

const PRIMARY = 'https://74-0-5-252.sslip.io'
const FALLBACK = 'https://app-salinha.bhrx.com.br'

/** fetch falso: por origem, um status HTTP, um erro de rede ou "nunca responde". */
function fakeFetch(by: Record<string, number | Error | 'hang'>): ProbeFetch {
  return (url, { signal }) => {
    const answer = by[new URL(url).origin]
    if (answer === 'hang') {
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      )
    }
    if (answer instanceof Error) return Promise.reject(answer)
    return Promise.resolve({ status: answer })
  }
}

describe('probeServer', () => {
  it('qualquer resposta HTTP conta como alcançado (a rede chegou ao servidor)', async () => {
    const probe = await probeServer(PRIMARY, fakeFetch({ [PRIMARY]: 503 }), 1000)
    expect(probe).toMatchObject({ url: PRIMARY, ok: true, detail: 'HTTP 503' })
  })

  it('erro de rede guarda a mensagem real do Chromium (DNS, certificado, recusa)', async () => {
    const fetch = fakeFetch({ [PRIMARY]: new Error('net::ERR_NAME_NOT_RESOLVED') })
    const probe = await probeServer(PRIMARY, fetch, 1000)
    expect(probe).toMatchObject({ ok: false, detail: 'net::ERR_NAME_NOT_RESOLVED' })
  })

  it('sem resposta no prazo: desiste e diz quanto esperou', async () => {
    const probe = await probeServer(PRIMARY, fakeFetch({ [PRIMARY]: 'hang' }), 20)
    expect(probe).toMatchObject({ ok: false, detail: 'sem resposta em 0,02 s' })
  })

  it('testa o /healthz da origem', async () => {
    let asked = ''
    await probeServer(PRIMARY, (url) => {
      asked = url
      return Promise.resolve({ status: 200 })
    })
    expect(asked).toBe(`${PRIMARY}/healthz`)
  })
})

describe('chooseServer', () => {
  it('usa o endereço principal quando ele responde', async () => {
    const fetch = fakeFetch({ [PRIMARY]: 200, [FALLBACK]: 200 })
    const choice = await chooseServer([PRIMARY, FALLBACK], (url) => probeServer(url, fetch, 50))
    expect(choice.url).toBe(PRIMARY)
  })

  it('não espera o alternativo quando o principal já respondeu', async () => {
    const fetch = fakeFetch({ [PRIMARY]: 200, [FALLBACK]: 'hang' })
    const choice = await chooseServer([PRIMARY, FALLBACK], (url) => probeServer(url, fetch, 5000))
    expect(choice.url).toBe(PRIMARY)
  })

  // Regressão: na rede de alguns usuários o sslip.io não resolve (ou é
  // bloqueado) e o app desktop ficava "Sem conexão" para sempre, enquanto o
  // app web (outro domínio, mesmo servidor) funcionava.
  it('principal inalcançável: cai no alternativo que responde', async () => {
    const fetch = fakeFetch({
      [PRIMARY]: new Error('net::ERR_NAME_NOT_RESOLVED'),
      [FALLBACK]: 200
    })
    const choice = await chooseServer([PRIMARY, FALLBACK], (url) => probeServer(url, fetch, 50))
    expect(choice.url).toBe(FALLBACK)
    const probes = await choice.probes
    expect(probes.map((p) => [p.url, p.ok])).toEqual([
      [PRIMARY, false],
      [FALLBACK, true]
    ])
  })

  it('nenhum responde: fica no principal (o aviso de conexão mostra o porquê)', async () => {
    const fetch = fakeFetch({ [PRIMARY]: new Error('x'), [FALLBACK]: new Error('y') })
    const choice = await chooseServer([PRIMARY, FALLBACK], (url) => probeServer(url, fetch, 50))
    expect(choice.url).toBe(PRIMARY)
  })
})

describe('updateFeedFor', () => {
  it('as atualizações vêm do servidor escolhido', () => {
    expect(updateFeedFor(`${PRIMARY}/updates/`, FALLBACK)).toBe(`${FALLBACK}/updates/`)
  })

  it('build sem atualização (dev) continua sem', () => {
    expect(updateFeedFor('', FALLBACK)).toBe('')
    expect(updateFeedFor(`${PRIMARY}/updates/`, undefined)).toBe(`${PRIMARY}/updates/`)
  })
})
