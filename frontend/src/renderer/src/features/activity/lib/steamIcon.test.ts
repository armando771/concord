import { describe, expect, it } from 'vitest'
import { steamIconUrl } from './steamIcon'

const HASH = '0e56e01c18bf303a65ba60dddfa842cc85d1da33'

describe('steamIconUrl', () => {
  it('monta o endereço pelo appid e pelo hash', () => {
    expect(steamIconUrl(2661300, HASH)).toBe(
      `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/2661300/${HASH}.jpg`
    )
  })

  it('recusa appid ou hash inválidos', () => {
    expect(steamIconUrl(undefined, HASH)).toBeNull()
    expect(steamIconUrl(0, HASH)).toBeNull()
    expect(steamIconUrl(730, undefined)).toBeNull()
    expect(steamIconUrl(730, '../x')).toBeNull()
    expect(steamIconUrl(730, HASH.toUpperCase())).toBeNull()
  })
})
