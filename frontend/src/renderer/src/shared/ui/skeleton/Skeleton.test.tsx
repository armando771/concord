import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Skeleton, SkeletonRegion } from './Skeleton'
import {
  AppBootSkeleton,
  BadgeGridSkeleton,
  BadgeRowSkeleton,
  ChannelListSkeleton,
  DmListSkeleton,
  InvitePreviewSkeleton,
  MemberListSkeleton,
  MessageListSkeleton,
  PersonListSkeleton,
  ServerRailSkeleton
} from './layouts'

const count = (html: string, needle: string): number => html.split(needle).length - 1

describe('Skeleton', () => {
  it('é decorativo (aria-hidden) e usa a classe com o brilho', () => {
    const html = renderToStaticMarkup(<Skeleton className="h-3 w-24" />)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('class="skeleton ')
    expect(html).toContain('h-3 w-24')
  })

  it('circle vira círculo; sem circle, cantos suaves', () => {
    expect(renderToStaticMarkup(<Skeleton circle />)).toContain('rounded-full')
    expect(renderToStaticMarkup(<Skeleton />)).not.toContain('rounded-full')
  })

  it('aceita largura em estilo (barras de tamanho variado)', () => {
    expect(renderToStaticMarkup(<Skeleton style={{ width: '42%' }} />)).toContain('width:42%')
  })
})

describe('SkeletonRegion', () => {
  it('avisa o leitor de tela: status ocupado com rótulo', () => {
    const html = renderToStaticMarkup(
      <SkeletonRegion label="Carregando mensagens…">
        <Skeleton />
      </SkeletonRegion>
    )
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('aria-label="Carregando mensagens…"')
  })
})

describe('layouts: mesma estrutura da linha real (sem salto ao carregar)', () => {
  it('mensagens: avatar de 40px e nome + barras de 22px por linha', () => {
    const html = renderToStaticMarkup(<MessageListSkeleton />)
    expect(count(html, 'h-10 w-10')).toBeGreaterThanOrEqual(10)
    expect(html).toContain('px-4 py-1.5')
    expect(html).toContain('h-[22px]')
    expect(html).toContain('justify-end')
  })

  it('mensagens: larguras variadas', () => {
    const html = renderToStaticMarkup(<MessageListSkeleton />)
    const widths = new Set(html.match(/width:\d+%/g))
    expect(widths.size).toBeGreaterThan(5)
  })

  it('canais: linhas de 32px (h-8)', () => {
    const html = renderToStaticMarkup(<ChannelListSkeleton count={5} />)
    expect(count(html, 'h-8 items-center')).toBe(5)
  })

  it('membros: grupos com título e linhas px-2 py-1 de avatar 32px', () => {
    const html = renderToStaticMarkup(<MemberListSkeleton groups={[3, 2]} />)
    expect(count(html, 'px-2 py-1')).toBe(5)
    expect(count(html, 'h-8 w-8')).toBe(5)
    expect(count(html, 'h-[18px]')).toBeGreaterThanOrEqual(2)
  })

  it('DMs: px-2 py-1.5 com avatar de 32px', () => {
    const html = renderToStaticMarkup(<DmListSkeleton count={4} />)
    expect(count(html, 'px-2 py-1.5')).toBe(4)
    expect(count(html, 'h-8 w-8')).toBe(4)
  })

  it('amigos: py-2.5 como a linha real, com as ações em círculo de 36px', () => {
    const html = renderToStaticMarkup(<PersonListSkeleton count={3} actions={2} />)
    expect(count(html, 'px-2.5 py-2.5')).toBe(3)
    expect(count(html, 'h-9 w-9')).toBe(6)
  })

  it('ícones de servidor: 48px arredondados', () => {
    const html = renderToStaticMarkup(<ServerRailSkeleton count={4} />)
    expect(count(html, 'h-12 w-12 rounded-3xl')).toBe(4)
  })

  it('badges: fileira com 3 ícones de 22px e grade 4 por linha', () => {
    expect(count(renderToStaticMarkup(<BadgeRowSkeleton />), 'h-[22px] w-[22px]')).toBe(3)
    const grid = renderToStaticMarkup(<BadgeGridSkeleton count={8} />)
    expect(grid).toContain('grid-cols-4')
    expect(count(grid, 'aspect-square')).toBe(8)
  })

  it('convite: ícone de 64px e linha de nome de 32px', () => {
    const html = renderToStaticMarkup(<InvitePreviewSkeleton />)
    expect(html).toContain('h-16 w-16 rounded-2xl')
    expect(html).toContain('h-8')
  })

  it('casca do app mostra o aviso de rede quando há', () => {
    expect(renderToStaticMarkup(<AppBootSkeleton />)).not.toContain('Sem conexão')
    expect(renderToStaticMarkup(<AppBootSkeleton notice="Sem conexão" />)).toContain('Sem conexão')
  })
})

describe('CSS do skeleton (main.css)', () => {
  const css = readFileSync(resolve(__dirname, '../../../assets/main.css'), 'utf8')
  const skeletonCss = css.slice(
    css.indexOf('Skeleton de carregamento'),
    css.indexOf('.glass-panel')
  )

  it('respeita prefers-reduced-motion: sem animação', () => {
    expect(skeletonCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.skeleton::after\s*{[^}]*animation:\s*none/s
    )
  })

  it('as cores vêm de variáveis do tema, sem hexadecimal fixo', () => {
    expect(skeletonCss).toContain('var(--skeleton-base,')
    expect(skeletonCss).toContain('var(--bg-accent')
    expect(skeletonCss).toContain('var(--skeleton-shine,')
    expect(skeletonCss).toContain('var(--fg')
    expect(skeletonCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('o brilho anima só transform (compositor, sem repintar)', () => {
    expect(skeletonCss).toMatch(/@keyframes skeleton-shimmer\s*{[^}]*transform/)
  })
})
