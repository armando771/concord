// Build local do APK do app mobile (sem EAS nem conta Expo).
//
//   EXPO_PUBLIC_SERVER_URL=https://servidor node scripts/mobile-build.mjs
//
// Variáveis: ANDROID_HOME (Android SDK), EXPO_PUBLIC_SERVER_URL e, para um APK
// distribuível, SALINHA_KEYSTORE_PATH / _PASSWORD e SALINHA_KEY_ALIAS / _PASSWORD
// (keystore fora do repo, com backup: perdê-lo impede atualizar o APK instalado).
// JAVA_HOME deve ser um JDK 17+ aceito pelo Gradle do Expo.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { buildPlan } from './lib/mobileBuild.mjs'
import { ROOT, run } from './lib/run.mjs'

const mobile = path.join(ROOT, 'mobile')
const android = path.join(mobile, 'android')
const APK = path.join(android, 'app/build/outputs/apk/release/app-release.apk')

function main() {
  const plan = buildPlan(process.env)
  plan.warnings.forEach((w) => console.warn(`⚠️ ${w}`))
  if (plan.problems.length) {
    console.error(plan.problems.map((p) => `❌ ${p}`).join('\n'))
    process.exit(1)
  }

  if (run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], mobile) !== 0) process.exit(1)

  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
  // Não use run(): ele imprime os argumentos, e eles levam as senhas do keystore.
  console.log(`\n$ (mobile/android) ${gradlew} assembleRelease (${plan.gradleArgs.length ? 'assinado com o keystore' : 'chave de debug'})`)
  const result = spawnSync(gradlew, ['assembleRelease', ...plan.gradleArgs], {
    cwd: android,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) process.exit(result.status ?? 1)

  if (!existsSync(APK)) {
    console.error(`❌ O Gradle terminou, mas o APK não está em ${APK}`)
    process.exit(1)
  }
  console.log(`\n✅ APK pronto: ${APK}`)
}

main()
