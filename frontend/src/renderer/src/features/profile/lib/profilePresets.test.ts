import { describe, expect, it } from 'vitest'
import { resolveProfileTheme, sameTheme } from './profileTheme'
import { PROFILE_PRESETS } from './profilePresets'

describe('predefinições', () => {
  it('todas são temas válidos', () => {
    for (const p of PROFILE_PRESETS) {
      expect(sameTheme(resolveProfileTheme(p.theme), p.theme), p.id).toBe(true)
      expect(resolveProfileTheme(p.theme), p.id).toEqual(p.theme)
    }
  })
})
