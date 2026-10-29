// Regras da estrutura de pastas (docs/ai/arquitetura.md) e a catraca anti-god.
// Só funções puras: quem lê o git e o disco é scripts/check-structure.mjs.

export const GOD_LINES = 400

const RENDERER = 'frontend/src/renderer/src/'
const MAIN = 'frontend/src/main/'
const INTERNAL = 'backend/internal/'
const MOBILE_SRC = 'mobile/src/'

const FEATURE_KINDS = ['components', 'hooks', 'store', 'lib', 'api', 'pages']
const SHARED_KINDS = ['ui', 'lib', 'hooks', 'store', 'api']
const MOBILE_SHARED_KINDS = [...SHARED_KINDS, 'theme']
const RENDERER_ROOT = ['app', 'assets', 'features', 'overlay', 'shared', 'main.tsx', 'env.d.ts']

// structureError devolve o motivo de o arquivo estar fora do padrão, ou null.
export function structureError(file) {
  if (file.startsWith(RENDERER)) return rendererError(file.slice(RENDERER.length).split('/'))
  if (file.startsWith(MAIN)) return mainError(file.slice(MAIN.length).split('/'))
  if (file.startsWith(MOBILE_SRC)) return mobileError(file.slice(MOBILE_SRC.length).split('/'))
  if (file.startsWith(INTERNAL)) return internalError(file.slice(INTERNAL.length).split('/'))
  return null
}

function rendererError([top, second, third, ...rest]) {
  if (!RENDERER_ROOT.includes(top)) return `renderer/src aceita só ${RENDERER_ROOT.join(', ')}`
  if (top === 'features' && (third === undefined || !FEATURE_KINDS.includes(third) || rest.length === 0 && !third)) {
    return `features/<domínio>/ aceita só ${FEATURE_KINDS.join(', ')}`
  }
  if (top === 'shared' && (third === undefined || !SHARED_KINDS.includes(second))) {
    return `shared/ aceita só ${SHARED_KINDS.join(', ')}`
  }
  return null
}

// mobile/src: mesma estrutura por feature do renderer (ADR 0021).
function mobileError([top, second, third]) {
  if (!['features', 'shared'].includes(top) || second === undefined) return 'mobile/src aceita só features/<domínio>/ e shared/<tipo>/'
  if (top === 'features' && (third === undefined || !FEATURE_KINDS.includes(third))) {
    return `features/<domínio>/ aceita só ${FEATURE_KINDS.join(', ')}`
  }
  if (top === 'shared' && (third === undefined || !MOBILE_SHARED_KINDS.includes(second))) {
    return `shared/ aceita só ${MOBILE_SHARED_KINDS.join(', ')}`
  }
  return null
}

function mainError(parts) {
  if (parts.length === 1 && !['index.ts', 'env.d.ts'].includes(parts[0])) {
    return 'src/main: arquivo solto; use a pasta da responsabilidade (activity, app, overlay, screen, updates, window...)'
  }
  return null
}

function internalError(parts) {
  if (parts.length === 1) return 'backend/internal: arquivo solto; use internal/<domínio>/ ou internal/platform/<infra>/'
  if (parts[0] === 'platform' && parts.length === 2) return 'internal/platform: arquivo solto; use internal/platform/<infra>/'
  return null
}

const isSource = (f) => /\.(go|ts|tsx)$/.test(f) && !/(_test\.go|\.test\.tsx?|\.d\.ts)$/.test(f)

// godError: arquivo tocado acima do limite precisa sair do PR menor do que
// entrou (extraia a responsabilidade que você mexeu). before = null para arquivo novo.
export function godError(file, before, after) {
  if (!isSource(file) || after <= GOD_LINES) return null
  if (before === null) return `arquivo novo com ${after} linhas (limite ${GOD_LINES}): divida por responsabilidade`
  if (after >= before) return `god file tocado (${before} → ${after} linhas): extraia a responsabilidade alterada até ele encolher`
  return null
}
