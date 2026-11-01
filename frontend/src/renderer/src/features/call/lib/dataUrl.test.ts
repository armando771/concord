import { describe, expect, it } from 'vitest'
import { decodeDataUrl } from './dataUrl'

describe('decodeDataUrl', () => {
  it('devolve os bytes do base64 depois da vírgula', () => {
    const bytes = new Uint8Array([0, 97, 115, 109, 255])
    const url = `data:application/wasm;base64,${Buffer.from(bytes).toString('base64')}`
    expect(new Uint8Array(decodeDataUrl(url))).toEqual(bytes)
  })
})
