// Regressão do modal compartilhado, sem backend ou login.
// Uso: node scripts/e2e-modal.mjs (Chromium do Playwright instalado).
// Ou: CHROME_PATH=/usr/bin/google-chrome node scripts/e2e-modal.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const frontend = fileURLToPath(new URL('../frontend', import.meta.url))
const require = createRequire(`${frontend}/package.json`)
const { createServer } = await import(require.resolve('vite'))
const { default: react } = await import(require.resolve('@vitejs/plugin-react'))
const { default: tailwindcss } = await import(require.resolve('@tailwindcss/vite'))
const { chromium } = require('playwright')

const fixture = `
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import Modal from '/src/renderer/src/shared/ui/Modal.tsx'
import '/src/renderer/src/assets/main.css'

function Fixture() {
  const [open, setOpen] = useState(false)
  return <>
    <div className="app-drag" style={{ height: 32 }}>Barra da janela</div>
    <div style={{ transform: 'translateZ(0)', width: 240, height: 180, overflow: 'hidden' }}>
      <button onClick={() => setOpen(true)}>Abrir configurações</button>
      <Modal open={open} title="Configurações de Usuário" onClose={() => setOpen(false)}>
        <div style={{ height: 1200 }}>Conteúdo longo das configurações</div>
        <button>Última opção</button>
      </Modal>
    </div>
  </>
}
createRoot(document.getElementById('root')).render(<Fixture />)
document.documentElement.style.setProperty('--titlebar-height', '32px')
`

const server = await createServer({
  root: frontend,
  configFile: false,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'modal-test-fixture',
      resolveId(id) {
        if (id === '/modal-test.tsx') return id
      },
      load(id) {
        if (id === '/modal-test.tsx') return fixture
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== '/') return next()
          const html = await server.transformIndexHtml('/',
            '<html><body><div id="root"></div><script type="module" src="/modal-test.tsx"></script></body></html>')
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
        })
      }
    }
  ],
  server: { host: '127.0.0.1', port: 0 }
})

let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH })
  const page = await browser.newPage()
  await page.goto(server.resolvedUrls.local[0])
  const dialog = page.getByRole('dialog', { name: 'Configurações de Usuário' })
  const close = dialog.getByRole('button', { name: 'Fechar', exact: true })
  await page.getByRole('button', { name: 'Abrir configurações' }).click()

  for (const [width, height] of [[1280, 720], [800, 600], [480, 360], [320, 240], [1920, 1080]]) {
    await page.setViewportSize({ width, height })
    const bounds = await dialog.boundingBox()
    assert(bounds.x >= 16 && bounds.y >= 48, `margens em ${width}x${height}`)
    assert(bounds.x + bounds.width <= width - 16, 'largura dentro da janela')
    assert(bounds.y + bounds.height <= height - 16, 'altura dentro da janela')
    const before = await close.boundingBox()
    await dialog.getByRole('button', { name: 'Última opção' }).scrollIntoViewIfNeeded()
    const after = await close.boundingBox()
    assert.equal(after.y, before.y, 'X permanece fixo durante a rolagem')
    await close.click()
    await dialog.waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Abrir configurações' }).click()
    console.log(`PASS modal redimensionado e X clicável: ${width}x${height}`)
  }

  await dialog.getByText('Conteúdo longo das configurações').click()
  assert(await dialog.isVisible(), 'clique interno não fecha')
  await page.mouse.click(2, 50)
  await dialog.waitFor({ state: 'detached' })
  await page.evaluate(() => document.documentElement.style.removeProperty('--titlebar-height'))
  await page.getByRole('button', { name: 'Abrir configurações' }).click()
  assert((await dialog.boundingBox()).y >= 16, 'funciona sem barra de título customizada')
  await close.click()
  console.log('PASS clique interno, clique externo e janela sem barra customizada')
} finally {
  await browser?.close()
  await server.close()
}
