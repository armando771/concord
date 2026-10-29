import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apkInfo, buildDir, buildPlan, cmakeDirProperty, ninjaSupportsLongPaths } from './mobileBuild.mjs'

const SIGNING = {
  SALINHA_KEYSTORE_PATH: 'C:/chaves/salinha.jks',
  SALINHA_KEYSTORE_PASSWORD: 'senha-loja',
  SALINHA_KEY_ALIAS: 'salinha',
  SALINHA_KEY_PASSWORD: 'senha-chave'
}

const OK = { ANDROID_HOME: 'C:/Android/Sdk', EXPO_PUBLIC_SERVER_URL: 'https://salinha.exemplo.com' }

test('sem ANDROID_HOME nem ANDROID_SDK_ROOT: aponta o que falta', () => {
  const plan = buildPlan({ EXPO_PUBLIC_SERVER_URL: 'https://x.co' })
  assert.match(plan.problems.join('\n'), /ANDROID_HOME/)
})

test('sem EXPO_PUBLIC_SERVER_URL: o APK apontaria para o localhost', () => {
  const plan = buildPlan({ ANDROID_HOME: 'C:/Android/Sdk' })
  assert.match(plan.problems.join('\n'), /EXPO_PUBLIC_SERVER_URL/)
})

test('ANDROID_SDK_ROOT também vale', () => {
  const plan = buildPlan({ ANDROID_SDK_ROOT: 'C:/Android/Sdk', EXPO_PUBLIC_SERVER_URL: 'https://x.co' })
  assert.deepEqual(plan.problems, [])
})

test('com o keystore completo: argumentos de assinatura do Gradle', () => {
  const plan = buildPlan({ ...OK, ...SIGNING })
  assert.deepEqual(plan.problems, [])
  assert.deepEqual(plan.warnings, [])
  assert.deepEqual(plan.gradleArgs, [
    '-Pandroid.injected.signing.store.file=C:/chaves/salinha.jks',
    '-Pandroid.injected.signing.store.password=senha-loja',
    '-Pandroid.injected.signing.key.alias=salinha',
    '-Pandroid.injected.signing.key.password=senha-chave'
  ])
})

test('sem keystore: avisa que o APK sai com a chave de debug', () => {
  const plan = buildPlan(OK)
  assert.deepEqual(plan.problems, [])
  assert.deepEqual(plan.gradleArgs, [])
  assert.match(plan.warnings.join('\n'), /chave de debug/)
})

test('keystore pela metade é erro (não assina calado com a chave errada)', () => {
  const plan = buildPlan({ ...OK, SALINHA_KEYSTORE_PATH: 'C:/chaves/salinha.jks' })
  assert.match(plan.problems.join('\n'), /SALINHA_KEYSTORE_PASSWORD/)
  assert.match(plan.problems.join('\n'), /SALINHA_KEY_ALIAS/)
})

test('nunca imprime as senhas nos avisos nem nos problemas', () => {
  const plan = buildPlan({ ...OK, ...SIGNING })
  const text = [...plan.problems, ...plan.warnings].join('\n')
  assert.ok(!text.includes('senha-loja') && !text.includes('senha-chave'))
})

test('buildDir: Windows com caminho longo builda numa pasta curta (limite de 260 do ninja)', () => {
  const long = String.raw`C:\Users\hugoe\Documents\concord-app-mobile\mobile`
  assert.equal(buildDir('win32', long, {}), String.raw`C:\sb`)
  assert.equal(buildDir('win32', long, { SALINHA_BUILD_DIR: String.raw`D:\x` }), String.raw`D:\x`)
})

test('buildDir: caminho já curto, ou fora do Windows, builda no próprio lugar', () => {
  assert.equal(buildDir('win32', String.raw`C:\dev\mobile`, {}), null)
  assert.equal(buildDir('linux', '/home/ana/concord-app-mobile/mobile', {}), null)
})

test('ninjaSupportsLongPaths: só do 1.12 em diante (manifesto de caminho longo)', () => {
  assert.equal(ninjaSupportsLongPaths('1.13.2\n'), true)
  assert.equal(ninjaSupportsLongPaths('1.12.0'), true)
  assert.equal(ninjaSupportsLongPaths('1.10.2'), false)
  assert.equal(ninjaSupportsLongPaths('2.0.0'), true)
  assert.equal(ninjaSupportsLongPaths('lixo'), false)
  assert.equal(ninjaSupportsLongPaths(''), false)
})

test('cmakeDirProperty: linha do local.properties com barras normais', () => {
  assert.equal(cmakeDirProperty(String.raw`C:\sb\.cmake`), 'cmake.dir=C:/sb/.cmake')
})

test('modo dev: não exige a URL do servidor nem keystore (o Metro entrega o JS)', () => {
  const plan = buildPlan({ ANDROID_HOME: 'C:/Android/Sdk' }, 'dev')
  assert.deepEqual(plan.problems, [])
  assert.deepEqual(plan.warnings, [])
  assert.deepEqual(plan.gradleArgs, [])
})

test('modo dev ignora um keystore pela metade (não é usado)', () => {
  const plan = buildPlan({ ANDROID_HOME: 'C:/Android/Sdk', SALINHA_KEYSTORE_PATH: 'x' }, 'dev')
  assert.deepEqual(plan.problems, [])
})

test('modo dev ainda exige o Android SDK', () => {
  assert.match(buildPlan({}, 'dev').problems.join('\n'), /ANDROID_HOME/)
})

test('modo release continua sendo o padrão', () => {
  assert.match(buildPlan({ ANDROID_HOME: 'C:/Android/Sdk' }).problems.join('\n'), /EXPO_PUBLIC_SERVER_URL/)
})

test('apkInfo: tarefa do Gradle, caminho do APK gerado e nome da cópia', () => {
  assert.deepEqual(apkInfo('release'), {
    task: 'assembleRelease',
    built: 'app/build/outputs/apk/release/app-release.apk',
    out: 'dist/salinha.apk'
  })
  assert.deepEqual(apkInfo('dev'), {
    task: 'assembleDebug',
    built: 'app/build/outputs/apk/debug/app-debug.apk',
    out: 'dist/salinha-dev.apk'
  })
})
