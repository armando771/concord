import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import * as icons from './index'
import type { IconProps } from './Icon'

const RENDERER = path.resolve(__dirname, '../../..')
const ICONS = Object.entries(icons).filter(([name]) => name.endsWith('Icon')) as [
  string,
  ComponentType<IconProps>
][]

/** Nomes importados de shared/ui/icons em todo o renderer (fora desta pasta). */
function importedNames(): Set<string> {
  const names = new Set<string>()
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (full !== __dirname) walk(full)
      } else if (/\.tsx?$/.test(entry.name)) {
        const src = readFileSync(full, 'utf8')
        for (const m of src.matchAll(
          /import\s*\{([^}]*)\}\s*from\s*'(?:[\w./]*\/ui|\.)\/icons'/g
        )) {
          for (const n of m[1].split(',')) {
            const name = n
              .replace(/^\s*type\s+/, '')
              .split(' as ')[0]
              .trim()
            if (name) names.add(name)
          }
        }
      }
    }
  }
  walk(RENDERER)
  return names
}

describe('shared/ui/icons', () => {
  it('reexporta todos os nomes que o app importa', () => {
    const missing = [...importedNames()].filter((n) => !(n in icons))
    expect(missing).toEqual([])
  })

  it('não tem mais os ícones mortos', () => {
    for (const dead of [
      'DiscordLogoIcon',
      'NitroIcon',
      'ShopIcon',
      'QuestsIcon',
      'CompassIcon',
      'InboxIcon'
    ]) {
      expect(dead in icons, dead).toBe(false)
    }
  })

  it.each(ICONS)('%s: tamanho padrão 20, escondido do leitor de tela', (_, Icon) => {
    const html = renderToStaticMarkup(<Icon />)
    expect(html).toMatch(/^<svg[^>]* width="20" height="20"/)
    expect(html).toContain('aria-hidden="true"')
  })

  it.each(ICONS)('%s: aceita os tamanhos da escala e a classe', (_, Icon) => {
    const html = renderToStaticMarkup(<Icon size={16} className="text-muted" />)
    expect(html).toMatch(/^<svg[^>]* width="16" height="16"/)
    expect(html).toContain('class="text-muted"')
  })
})
