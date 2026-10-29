// Build local do APK do app mobile (sem EAS nem conta Expo).
//
//   EXPO_PUBLIC_SERVER_URL=https://servidor node scripts/mobile-build.mjs
//
// Variáveis: ANDROID_HOME (Android SDK), EXPO_PUBLIC_SERVER_URL e, para um APK
// distribuível, SALINHA_KEYSTORE_PATH / _PASSWORD e SALINHA_KEY_ALIAS / _PASSWORD
// (keystore fora do repo, com backup: perdê-lo impede atualizar o APK instalado).
// JAVA_HOME deve ser um JDK aceito pelo Gradle do Expo (testado com 25).
// No Windows, com o repo em caminho longo, o build roda numa cópia em pasta curta
// (SALINHA_BUILD_DIR, padrão C:\sb) por causa do limite de 260 caracteres do ninja.
import { spawnSync } from 'node:child_process'
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { buildDir, buildPlan, cmakeDirProperty, ninjaSupportsLongPaths } from './lib/mobileBuild.mjs'
import { ROOT, run } from './lib/run.mjs'

const mobile = path.join(ROOT, 'mobile')
const OUT = path.join(mobile, 'dist/salinha.apk')

// Copia as fontes (sem node_modules, android e .expo) para a pasta curta e instala lá.
function syncToShortDir(dir) {
  mkdirSync(dir, { recursive: true })
  // robocopy devolve 0-7 em sucesso (bits de "copiou algo"), 8+ em erro.
  const copy = spawnSync('robocopy', [mobile, dir, '/MIR', '/XD', 'node_modules', 'android', '.expo', '.cmake', 'dist', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { stdio: 'inherit' })
  if ((copy.status ?? 8) >= 8) process.exit(1)
  if (run('yarn', ['install', '--frozen-lockfile'], dir) !== 0) process.exit(1)
}

// Caminho do ninja novo: SALINHA_NINJA_EXE ou o primeiro "ninja" do PATH.
function locateNinja() {
  if (process.env.SALINHA_NINJA_EXE) return process.env.SALINHA_NINJA_EXE
  const found = spawnSync('where', ['ninja'], { encoding: 'utf8' })
  return (found.stdout ?? '').split(/\r?\n/)[0].trim()
}

// O ninja do SDK (1.10) não cria pastas além de ~248 caracteres. Monta uma cópia do
// CMake do SDK com um ninja 1.12+ e aponta o AGP para ela (cmake.dir no local.properties).
function useLongPathCmake(workDir, android) {
  const ninja = locateNinja()
  const version = ninja ? spawnSync(ninja, ['--version'], { encoding: 'utf8' }).stdout ?? '' : ''
  if (!ninjaSupportsLongPaths(version)) {
    console.error('❌ Precisa do ninja 1.12 ou mais novo (o do SDK não aceita caminhos longos).')
    console.error('   Instale: winget install Ninja-build.Ninja (ou aponte SALINHA_NINJA_EXE).')
    process.exit(1)
  }
  const cmakeRoot = path.join(process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT, 'cmake')
  const sdkCmake = readdirSync(cmakeRoot).sort().pop()
  const dir = path.join(workDir, '.cmake')
  if (!existsSync(dir)) cpSync(path.join(cmakeRoot, sdkCmake), dir, { recursive: true })
  copyFileSync(ninja, path.join(dir, 'bin', 'ninja.exe'))
  appendFileSync(path.join(android, 'local.properties'), `${cmakeDirProperty(dir)}\n`)
}

function gradle(android, gradleArgs) {
  // No cmd.exe o executável da pasta atual precisa do ".\".
  const gradlew = process.platform === 'win32' ? String.raw`.\gradlew.bat` : './gradlew'
  // Não use run(): ele imprime os argumentos, e eles levam as senhas do keystore.
  console.log(`\n$ (${android}) ${gradlew} assembleRelease (${gradleArgs.length ? 'assinado com o keystore' : 'chave de debug'})`)
  const result = spawnSync(gradlew, ['assembleRelease', ...gradleArgs], {
    cwd: android,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  return result.status ?? 1
}

function main() {
  const plan = buildPlan(process.env)
  plan.warnings.forEach((w) => console.warn(`⚠️ ${w}`))
  if (plan.problems.length) {
    console.error(plan.problems.map((p) => `❌ ${p}`).join('\n'))
    process.exit(1)
  }

  const short = buildDir(process.platform, mobile, process.env)
  const workDir = short ?? mobile
  if (short) syncToShortDir(short)

  if (run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], workDir) !== 0) process.exit(1)
  const android = path.join(workDir, 'android')
  if (short) useLongPathCmake(workDir, android)
  const status = gradle(android, plan.gradleArgs)
  if (status !== 0) process.exit(status)

  const apk = path.join(android, 'app/build/outputs/apk/release/app-release.apk')
  if (!existsSync(apk)) {
    console.error(`❌ O Gradle terminou, mas o APK não está em ${apk}`)
    process.exit(1)
  }
  mkdirSync(path.dirname(OUT), { recursive: true })
  copyFileSync(apk, OUT)
  console.log(`\n✅ APK pronto: ${OUT}`)
}

main()
