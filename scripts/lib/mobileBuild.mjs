// Plano do build local do APK (scripts/mobile-build.mjs): valida o ambiente e
// monta os argumentos de assinatura do Gradle. Só funções puras.

const SIGNING = [
  ['SALINHA_KEYSTORE_PATH', 'store.file'],
  ['SALINHA_KEYSTORE_PASSWORD', 'store.password'],
  ['SALINHA_KEY_ALIAS', 'key.alias'],
  ['SALINHA_KEY_PASSWORD', 'key.password']
]

function signingPlan(env) {
  const present = SIGNING.filter(([name]) => env[name])
  if (present.length === 0) {
    return {
      args: [],
      problems: [],
      warnings: ['Sem keystore (SALINHA_KEYSTORE_*): o APK sai assinado com a chave de debug. Não distribua assim.']
    }
  }
  const missing = SIGNING.filter(([name]) => !env[name]).map(([name]) => name)
  if (missing.length) return { args: [], problems: [`Keystore incompleto, falta: ${missing.join(', ')}`], warnings: [] }
  return { args: SIGNING.map(([name, prop]) => `-Pandroid.injected.signing.${prop}=${env[name]}`), problems: [], warnings: [] }
}

// buildPlan: { problems, warnings, gradleArgs } a partir das variáveis de ambiente.
// As senhas só aparecem nos argumentos do Gradle, nunca nas mensagens.
// Modo 'dev' (build de desenvolvimento): o Metro entrega o JS e a URL do servidor, e o APK é de debug,
// então não precisa de EXPO_PUBLIC_SERVER_URL nem de keystore.
export function buildPlan(env, mode = 'release') {
  const problems = []
  if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT) problems.push('Defina ANDROID_HOME (pasta do Android SDK).')
  if (mode === 'dev') return { problems, warnings: [], gradleArgs: [] }
  if (!env.EXPO_PUBLIC_SERVER_URL) {
    problems.push('Defina EXPO_PUBLIC_SERVER_URL (endereço do servidor): sem ele o APK aponta para o localhost.')
  }
  const signing = signingPlan(env)
  return {
    problems: [...problems, ...signing.problems],
    warnings: signing.warnings,
    gradleArgs: signing.args
  }
}

// O ninja do SDK (CMake 3.22) não passa de 260 caracteres de caminho, e o
// react-native-worklets embute o caminho do fonte no do objeto. No Windows, com
// o projeto em caminho longo, o build roda numa cópia em pasta curta.
const SHORT_PATH_LIMIT = 30
export const DEFAULT_BUILD_DIR = String.raw`C:\sb`

// buildDir: pasta curta para buildar, ou null para buildar no próprio lugar.
export function buildDir(platform, mobileDir, env) {
  if (platform !== 'win32' || mobileDir.length <= SHORT_PATH_LIMIT) return null
  return env.SALINHA_BUILD_DIR || DEFAULT_BUILD_DIR
}

// O ninja 1.12+ traz o manifesto de caminho longo; o do SDK (1.10) não passa de ~248.
export function ninjaSupportsLongPaths(versionOutput) {
  const match = /^(\d+)\.(\d+)/.exec(versionOutput.trim())
  if (!match) return false
  const [major, minor] = [Number(match[1]), Number(match[2])]
  return major > 1 || (major === 1 && minor >= 12)
}

// cmakeDirProperty: linha do android/local.properties que aponta o AGP para um CMake próprio.
const BACKSLASH = String.fromCharCode(92)
export const cmakeDirProperty = (dir) => `cmake.dir=${dir.replaceAll(BACKSLASH, '/')}`

// apkInfo: tarefa do Gradle, onde o APK sai (relativo a android/) e o nome da cópia em mobile/dist.
export function apkInfo(mode) {
  return mode === 'dev'
    ? { task: 'assembleDebug', built: 'app/build/outputs/apk/debug/app-debug.apk', out: 'dist/salinha-dev.apk' }
    : { task: 'assembleRelease', built: 'app/build/outputs/apk/release/app-release.apk', out: 'dist/salinha.apk' }
}
