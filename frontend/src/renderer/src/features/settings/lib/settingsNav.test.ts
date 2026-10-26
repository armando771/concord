import { describe, expect, it } from 'vitest'
import { SETTINGS_SECTIONS, filterSections } from './settingsNav'

const ids = (query: string): string[] => filterSections(query).map((s) => s.id)

describe('filterSections', () => {
  it('sem busca mostra tudo', () => {
    expect(filterSections('  ')).toHaveLength(SETTINGS_SECTIONS.length)
  })

  it('acha pelo nome da seção', () => {
    expect(ids('perfis')).toEqual(['profiles'])
    expect(ids('voz')).toEqual(['voice'])
  })

  it('acha pelo que tem dentro', () => {
    expect(ids('gif')).toEqual(['profiles'])
    expect(ids('rnnoise')).toEqual(['voice'])
    expect(ids('overlay')).toEqual(['app'])
    expect(ids('tema')).toEqual(['appearance'])
    expect(ids('modo escuro')).toEqual(['appearance'])
  })

  it('ignora acento e maiúscula', () => {
    expect(ids('NOTIFICACAO')).toEqual(['notifications'])
    expect(ids('aniversario')).toEqual(['profiles'])
    expect(ids('aparencia')).toEqual(['appearance'])
  })

  it('"Vídeo" fica logo depois de "Voz e áudio" e acha câmera e fundo', () => {
    const order = SETTINGS_SECTIONS.map((s) => s.id)
    expect(order.indexOf('video')).toBe(order.indexOf('voice') + 1)
    expect(SETTINGS_SECTIONS.find((s) => s.id === 'video')?.label).toBe('Vídeo')
    expect(ids('webcam')).toEqual(['video'])
    expect(ids('camera')).toEqual(['video'])
    expect(ids('desfoque')).toEqual(['video'])
    expect(ids('borrar')).toEqual(['video'])
    expect(ids('plano de fundo')).toEqual(['video'])
  })

  it('sem resultado volta vazio', () => {
    expect(ids('xyzzy')).toEqual([])
  })
})
