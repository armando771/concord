import assert from 'node:assert/strict'
import { test } from 'node:test'
import { godError, structureError } from './structure.mjs'

const R = 'frontend/src/renderer/src/'

test('renderer: feature por domínio e camada, shared por tipo', () => {
  assert.equal(structureError(R + 'features/chat/lib/mentions.ts'), null)
  assert.equal(structureError(R + 'features/settings/components/sections/PrivacySection.tsx'), null)
  assert.equal(structureError(R + 'shared/ui/Button.tsx'), null)
  assert.equal(structureError(R + 'app/App.tsx'), null)
  assert.equal(structureError(R + 'main.tsx'), null)
  assert.match(structureError(R + 'lib/mentions.ts'), /renderer\/src aceita só/)
  assert.match(structureError(R + 'features/chat/mentions.ts'), /features\/<domínio>/)
  assert.match(structureError(R + 'features/chat/utils/x.ts'), /features\/<domínio>/)
  assert.match(structureError(R + 'shared/helpers/x.ts'), /shared\/ aceita só/)
})

test('main do Electron e backend/internal: nada solto', () => {
  assert.equal(structureError('frontend/src/main/index.ts'), null)
  assert.equal(structureError('frontend/src/main/updates/updater.ts'), null)
  assert.match(structureError('frontend/src/main/novo.ts'), /arquivo solto/)
  assert.equal(structureError('backend/internal/call/service.go'), null)
  assert.equal(structureError('backend/internal/platform/database/postgres.go'), null)
  assert.match(structureError('backend/internal/util.go'), /arquivo solto/)
  assert.match(structureError('backend/internal/platform/util.go'), /arquivo solto/)
  assert.equal(structureError('scripts/x.mjs'), null)
})

test('catraca anti-god: god file tocado tem que encolher', () => {
  assert.equal(godError('a.go', 100, 300), null)
  assert.equal(godError('a.go', 2000, 1900), null)
  assert.match(godError('a.go', 2000, 2000), /extraia a responsabilidade/)
  assert.match(godError('a.ts', 380, 420), /extraia/)
  assert.match(godError('novo.tsx', null, 500), /arquivo novo/)
  assert.equal(godError('a_test.go', 900, 1000), null)
  assert.equal(godError('a.test.ts', null, 1000), null)
})

test('mobile/src: feature por domínio e camada, shared por tipo, nada solto', () => {
  assert.equal(structureError('mobile/src/features/auth/lib/authRefresh.ts'), null)
  assert.equal(structureError('mobile/src/features/auth/components/LoginForm.tsx'), null)
  assert.equal(structureError('mobile/src/shared/ui/Button.tsx'), null)
  assert.equal(structureError('mobile/src/shared/theme/tokens.ts'), null)
  assert.equal(structureError('mobile/app/_layout.tsx'), null)
  assert.equal(structureError('mobile/app.config.ts'), null)
  assert.match(structureError('mobile/src/util.ts'), /mobile\/src aceita só/)
  assert.match(structureError('mobile/src/features/auth/solto.ts'), /features\/<domínio>/)
  assert.match(structureError('mobile/src/features/auth/utils/x.ts'), /features\/<domínio>/)
  assert.match(structureError('mobile/src/shared/helpers/x.ts'), /shared\/ aceita só/)
})
