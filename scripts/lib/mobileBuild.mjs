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
export function buildPlan(env) {
  const problems = []
  if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT) problems.push('Defina ANDROID_HOME (pasta do Android SDK).')
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
