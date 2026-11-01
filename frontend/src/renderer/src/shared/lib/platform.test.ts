import { describe, expect, it } from 'vitest'
import { appTarget } from './platform'

describe('appTarget', () => {
  it('o build web marca o alvo como "web"', () => {
    expect(appTarget('web')).toBe('web')
  })

  it('qualquer outra coisa (inclusive nada) é o app desktop', () => {
    expect(appTarget(undefined)).toBe('desktop')
    expect(appTarget('')).toBe('desktop')
    expect(appTarget('electron')).toBe('desktop')
  })
})
