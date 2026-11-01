import type { Channel } from '../api/channels'
import { channelSections } from './channelSections'

const ch = (id: string, type: 'text' | 'voice', position = 0): Channel => ({
  id,
  server_id: 's',
  name: id,
  type,
  position,
  created_by: 'u',
  created_at: '',
  updated_at: ''
})

describe('channelSections', () => {
  it('separa texto e voz, respeitando a ordem que o servidor mandou', () => {
    const sections = channelSections([ch('t2', 'text', 1), ch('v1', 'voice', 0), ch('t1', 'text', 0)])
    expect(sections.map((s) => [s.kind, s.channels.map((c) => c.id)])).toEqual([
      ['text', ['t1', 't2']],
      ['voice', ['v1']]
    ])
  })

  it('seção sem canais não aparece', () => {
    expect(channelSections([ch('t1', 'text')]).map((s) => s.kind)).toEqual(['text'])
    expect(channelSections([])).toEqual([])
  })

  it('rótulos do desktop', () => {
    const [text, voice] = channelSections([ch('t', 'text'), ch('v', 'voice')])
    expect(text.title).toBe('Canais de texto')
    expect(voice.title).toBe('Canais de voz')
  })
})
