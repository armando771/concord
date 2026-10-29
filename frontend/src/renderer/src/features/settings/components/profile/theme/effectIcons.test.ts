import { describe, expect, it } from 'vitest'
import { PROFILE_EFFECTS } from '../../../../profile/lib/profileTheme'
import { EFFECT_ICONS } from './effectIcons'

describe('EFFECT_ICONS', () => {
  it('todo efeito tem ícone, e cada um é diferente', () => {
    for (const e of PROFILE_EFFECTS) expect(EFFECT_ICONS[e.id], e.id).toBeTypeOf('function')
    const icons = PROFILE_EFFECTS.map((e) => EFFECT_ICONS[e.id])
    expect(new Set(icons).size).toBe(icons.length)
  })
})
