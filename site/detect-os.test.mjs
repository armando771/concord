import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectOS } from './detect-os.js'

const UA = {
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  cros: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120 Safari/537.36',
}

test('usa userAgentData.platform quando existe', () => {
  assert.equal(detectOS('Windows', ''), 'windows')
  assert.equal(detectOS('Linux', ''), 'linux')
  assert.equal(detectOS('macOS', UA.mac), 'other')
})

test('cai para o userAgent sem platform', () => {
  assert.equal(detectOS(undefined, UA.win), 'windows')
  assert.equal(detectOS('', UA.linux), 'linux')
  assert.equal(detectOS(undefined, UA.mac), 'other')
})

test('celular e ChromeOS contam como outro, mesmo com "Linux" no UA', () => {
  assert.equal(detectOS('Android', UA.android), 'other')
  assert.equal(detectOS('Linux', UA.android), 'other')
  assert.equal(detectOS(undefined, UA.android), 'other')
  assert.equal(detectOS(undefined, UA.iphone), 'other')
  assert.equal(detectOS(undefined, UA.cros), 'other')
})

test('desconhecido vira outro', () => {
  assert.equal(detectOS(undefined, undefined), 'other')
  assert.equal(detectOS('', ''), 'other')
})
