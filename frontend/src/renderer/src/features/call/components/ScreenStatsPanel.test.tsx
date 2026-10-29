import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ScreenStatsCorner, { ScreenStatsCard, StatsCorner } from './ScreenStatsPanel'
import { useScreenStatsStore } from '../store/screenStatsStore'

const bia = { userId: 'bia', local: false }

describe('ScreenStatsCorner', () => {
  beforeEach(() => useScreenStatsStore.getState().close())

  it('fechado: só o ícone (sem painel e sem coleta)', () => {
    const html = renderToStaticMarkup(<ScreenStatsCorner owner={bia} />)
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('role="dialog"')
  })

  it('aberto: mostra o painel medindo', () => {
    const html = renderToStaticMarkup(
      <StatsCorner owner={bia} open onToggle={() => {}} onClose={() => {}} />
    )
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Medindo…')
    expect(html).toContain('Recebendo')
  })
})

describe('ScreenStatsCard', () => {
  it('linhas, aviso de pausa e botão de fechar; cabe em 360 px', () => {
    const html = renderToStaticMarkup(
      <ScreenStatsCard
        local={false}
        onClose={() => {}}
        view={{
          rows: [{ label: 'Codec', value: 'H264' }],
          status: 'Vídeo pausado (fora de vista)'
        }}
      />
    )
    expect(html).toContain('H264')
    expect(html).toContain('Vídeo pausado (fora de vista)')
    expect(html).toContain('aria-label="Fechar estatísticas"')
    expect(html).toContain('max-w-[calc(100%-1rem)]')
  })

  it('minha transmissão', () => {
    const html = renderToStaticMarkup(
      <ScreenStatsCard local onClose={() => {}} view={{ rows: [], status: null }} />
    )
    expect(html).toContain('Sua transmissão')
    expect(html).not.toContain('<dl')
  })
})
