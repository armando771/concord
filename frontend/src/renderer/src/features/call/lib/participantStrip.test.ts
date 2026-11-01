import { describe, expect, it } from 'vitest'
import { participantStripState } from './participantStrip'

describe('participantStripState', () => {
  it('sem live em destaque a faixa aparece sempre e não há o que alternar', () => {
    expect(participantStripState(false, false)).toEqual({ toggleable: false, visible: true })
    expect(participantStripState(false, true)).toEqual({ toggleable: false, visible: true })
  })

  it('com live em destaque a faixa segue a preferência', () => {
    expect(participantStripState(true, false)).toEqual({ toggleable: true, visible: true })
    expect(participantStripState(true, true)).toEqual({ toggleable: true, visible: false })
  })
})
