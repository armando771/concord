if (process.platform === 'win32') process.exit(0);
// Testa scripts/apply-caddyfile.sh com comandos falsos: o ssh junta os
// argumentos como o OpenSSH e roda o "servidor" em pastas temporárias.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const SCRIPT = new URL('./apply-caddyfile.sh', import.meta.url).pathname

function stub(dir, name, body) {
  writeFileSync(join(dir, name), `#!/usr/bin/env bash\n${body}\n`)
  chmodSync(join(dir, name), 0o755)
}

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'apply-caddy-test-'))
  const bin = join(base, 'bin')
  const caddy = join(base, 'caddy')
  const concord = join(base, 'concord')
  for (const d of [bin, caddy, join(concord, 'updates')]) mkdirSync(d, { recursive: true })
  writeFileSync(join(caddy, 'Caddyfile'), 'antigo\n')
  writeFileSync(join(concord, '.env'), 'PORT=8090\nPUBLIC_URL=https://app.example\n')
  writeFileSync(join(concord, 'updates', 'latest.yml'), 'version: 1\n')
  const log = join(base, 'log')
  writeFileSync(log, '')
  stub(bin, 'ssh', 'shift; exec bash -c "$*"')
  stub(bin, 'caddy', 'grep -q invalido "$3" && { echo "erro de sintaxe"; exit 1; }; exit 0')
  stub(bin, 'systemctl', 'echo "systemctl $*" >> "$LOG"; [ "$1" = is-active ] && exit 3; exit 0')
  stub(bin, 'docker', 'echo "docker $*" >> "$LOG"; echo "${IN_CALL:-0}"')
  stub(bin, 'curl', `
url="\${@: -1}"; echo "curl $url" >> "$LOG"
case "$url" in
  */rtc/validate) code=401; [[ "$url" == *quebrado* ]] && code=502
    for a in "$@"; do [ "$a" = '%{http_code}' ] && { printf %s "$code"; exit 0; }; done ;;
  */healthz) echo '{"status":"ok"}' ;;
esac
exit 0`)
  const file = join(base, 'Caddyfile.novo')
  writeFileSync(file, 'novo\n')
  return { base, caddy, concord, log, file, env: { PATH: `${bin}:${process.env.PATH}`, LOG: log } }
}

function apply(ctx, args, extra = {}) {
  const env = { ...process.env, ...ctx.env, CADDY_DIR: ctx.caddy, CONCORD_DIR: ctx.concord, ...extra }
  const r = spawnSync('bash', [SCRIPT, ...args, 'root@vps', ctx.file], { env, encoding: 'utf8' })
  return { ...r, log: readFileSync(ctx.log, 'utf8'), current: readFileSync(join(ctx.caddy, 'Caddyfile'), 'utf8') }
}

test('sem --also funciona (o ssh não engole argumento vazio)', () => {
  const ctx = setup()
  const r = apply(ctx, [])
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.current, 'novo\n')
  assert.match(r.log, /systemctl reload caddy/)
})

test('confere todos os --also, não só o primeiro', () => {
  const ctx = setup()
  const r = apply(ctx, ['--also', 'https://a.example', '--also', 'https://b.example'])
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.log, /curl https:\/\/a\.example\/rtc\/validate/)
  assert.match(r.log, /curl https:\/\/b\.example\/rtc\/validate/)
})

test('um --also que falha volta o Caddyfile anterior', () => {
  const ctx = setup()
  const r = apply(ctx, ['--also', 'https://a.example', '--also', 'https://quebrado.example'])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /quebrado\.example/)
  assert.equal(r.current, 'antigo\n')
})

test('gente em chamada (DM tocando ou ativa conta): não recarrega', () => {
  const ctx = setup()
  const r = apply(ctx, [], { IN_CALL: '2' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /2 pessoa\(s\) em chamada/)
  assert.match(r.log, /status <> 'ended'/)
  assert.doesNotMatch(r.log, /reload/)
  assert.equal(r.current, 'antigo\n')
})

test('Caddyfile inválido não muda nada', () => {
  const ctx = setup()
  writeFileSync(ctx.file, 'invalido\n')
  const r = apply(ctx, [])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /inválido/)
  assert.equal(r.current, 'antigo\n')
})
