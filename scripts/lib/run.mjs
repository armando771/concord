// Executa comandos externos a partir da raiz do repo. No Windows passa pelo
// shell para achar npx/go.cmd.
import { spawnSync } from 'node:child_process'
import path from 'node:path'

export const ROOT = path.resolve(import.meta.dirname, '../..')
export const GO = process.env.GO || 'go'

const shell = process.platform === 'win32'

// quote protege o argumento no cmd.exe (espaço, |, &, <, >, ^) e escapa as
// aspas internas como \" para o executável recebê-las.
const quote = (a) => (/[\s"|&<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)

// run mostra a saída no terminal e devolve o código de saída.
export function run(cmd, args, cwd = ROOT) {
  console.log(`\n$ (${path.relative(ROOT, cwd) || '.'}) ${cmd} ${args.join(' ')}`)
  const quoted = shell ? args.map(quote) : args
  return spawnSync(cmd, quoted, { cwd, stdio: 'inherit', shell }).status ?? 1
}

// capture devolve o stdout (para comandos que geram dados, ex.: JSON).
export function capture(cmd, args, cwd = ROOT) {
  const quoted = shell ? args.map(quote) : args
  const result = spawnSync(cmd, quoted, { cwd, encoding: 'utf8', shell, maxBuffer: 64 << 20 })
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} falhou:\n${result.stderr}`)
  return result.stdout
}
