import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../../../shared/lib/config'
import { useAuthStore } from '../../auth/store/authStore'
import { uploadAttachment } from './attachments'
import { ApiError } from '../../../shared/api/client'

/** XMLHttpRequest de mentira: guarda o pedido e responde quando o teste mandar. */
class FakeXhr {
  static last: FakeXhr | null = null
  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: FormData | null = null
  status = 0
  responseText = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  private progressListeners: ((e: {
    lengthComputable: boolean
    loaded: number
    total: number
  }) => void)[] = []
  upload = {
    addEventListener: (
      _type: string,
      fn: (e: { lengthComputable: boolean; loaded: number; total: number }) => void
    ) => {
      this.progressListeners.push(fn)
    }
  }

  constructor() {
    FakeXhr.last = this
  }

  open(method: string, url: string): void {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value
  }

  send(body: FormData): void {
    this.body = body
  }

  abort(): void {
    this.onabort?.()
  }

  respond(status: number, body: unknown): void {
    this.status = status
    this.responseText = JSON.stringify(body)
    this.onload?.()
  }

  progress(loaded: number, total: number): void {
    for (const fn of this.progressListeners) fn({ lengthComputable: true, loaded, total })
  }
}

describe('uploadAttachment', () => {
  beforeEach(() => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    useAuthStore.setState({ accessToken: 'A' })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envia o arquivo com as medidas e avisa o progresso', async () => {
    const onProgress = vi.fn()
    const promise = uploadAttachment(
      'channel:c1',
      new Blob(['oi'], { type: 'image/png' }),
      { filename: 'foto.png', width: 640, height: 480 },
      { onProgress }
    )
    const xhr = FakeXhr.last!
    expect(xhr.method).toBe('POST')
    expect(xhr.url).toBe(`${API_BASE_URL}/channels/c1/attachments`)
    expect(xhr.headers['Authorization']).toBe('Bearer A')
    expect(xhr.body?.get('file')).toBeTruthy()
    expect(xhr.body?.get('width')).toBe('640')
    expect(xhr.body?.has('duration_ms')).toBe(false)

    xhr.progress(50, 100)
    expect(onProgress).toHaveBeenCalledWith(0.5)

    xhr.respond(201, { id: 'a1', kind: 'image' })
    await expect(promise).resolves.toMatchObject({ id: 'a1', kind: 'image' })
  })

  it('erro do servidor vira ApiError com o status', async () => {
    const promise = uploadAttachment('conversation:d1', new Blob(['x']), { filename: 'x.mp4' })
    FakeXhr.last!.respond(413, { error: 'file too large' })
    const err = await promise.catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(413)
  })
})
