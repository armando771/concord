import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPiperSynth, type SpawnPiper } from './piperSynth'

const paths = { binary: '/v/piper/piper', model: '/v/voz.onnx' }

class FakeChild extends EventEmitter {
  stdin = new PassThrough()
  stdout = new PassThrough()
  written = ''
  kill = vi.fn(() => {
    this.emit('close', null)
    return true
  })
  constructor() {
    super()
    this.stdin.on('data', (c) => (this.written += c))
  }
  /** O piper escreveu o WAV e saiu. */
  finish(data: string, code = 0): void {
    this.stdout.end(data)
    setImmediate(() => this.emit('close', code))
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- dublê de teste
function fakeSpawn() {
  const children: FakeChild[] = []
  const spawn = vi.fn(() => {
    const child = new FakeChild()
    children.push(child)
    return child
  })
  return { spawn: spawn as unknown as SpawnPiper & typeof spawn, children }
}

afterEach(() => vi.useRealTimers())

describe('createPiperSynth', () => {
  it('manda o texto (uma linha) pelo stdin e devolve o WAV do stdout', async () => {
    const { spawn, children } = fakeSpawn()
    const synth = createPiperSynth({ spawn })
    const out = synth(paths, 'Ana disse:\noi  gente')
    await vi.waitFor(() => expect(children).toHaveLength(1))
    expect(spawn).toHaveBeenCalledWith(
      paths.binary,
      ['--model', paths.model, '--output_file', '-', '--quiet'],
      expect.objectContaining({ stdio: ['pipe', 'pipe', 'ignore'] })
    )
    children[0].finish('RIFF...')
    expect((await out).toString()).toBe('RIFF...')
    expect(children[0].written).toBe('Ana disse: oi gente\n')
  })

  it('travou: mata o processo depois do tempo-limite', async () => {
    vi.useFakeTimers()
    const { spawn, children } = fakeSpawn()
    const out = createPiperSynth({ spawn, timeoutMs: 15_000 })(paths, 'oi')
    const check = expect(out).rejects.toThrow('tempo')
    await vi.advanceTimersByTimeAsync(15_001)
    await check
    expect(children[0].kill).toHaveBeenCalledWith('SIGKILL')
  })

  it('saiu com erro: rejeita', async () => {
    const { spawn, children } = fakeSpawn()
    const out = createPiperSynth({ spawn })(paths, 'oi')
    await vi.waitFor(() => expect(children).toHaveLength(1))
    children[0].finish('', 1)
    await expect(out).rejects.toThrow('código 1')
  })

  it('não abriu (binário sumiu): rejeita', async () => {
    const { spawn, children } = fakeSpawn()
    const out = createPiperSynth({ spawn })(paths, 'oi')
    await vi.waitFor(() => expect(children).toHaveLength(1))
    children[0].emit('error', new Error('ENOENT'))
    await expect(out).rejects.toThrow('ENOENT')
  })

  it('saída grande demais: mata e rejeita', async () => {
    const { spawn, children } = fakeSpawn()
    const out = createPiperSynth({ spawn, maxBytes: 4 })(paths, 'oi')
    await vi.waitFor(() => expect(children).toHaveLength(1))
    children[0].stdout.write('12345')
    await expect(out).rejects.toThrow('grande')
    expect(children[0].kill).toHaveBeenCalled()
  })

  it('uma síntese por vez: a segunda só começa quando a primeira acaba', async () => {
    const { spawn, children } = fakeSpawn()
    const synth = createPiperSynth({ spawn })
    const a = synth(paths, 'um')
    const b = synth(paths, 'dois')
    await vi.waitFor(() => expect(children).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 5))
    expect(children).toHaveLength(1)
    children[0].finish('A', 1)
    await expect(a).rejects.toThrow()
    await vi.waitFor(() => expect(children).toHaveLength(2))
    children[1].finish('B')
    expect((await b).toString()).toBe('B')
  })
})
