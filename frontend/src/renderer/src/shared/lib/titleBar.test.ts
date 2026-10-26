import { describe, expect, it } from 'vitest'
import { hasCustomTitleBar } from './titleBar'

describe('hasCustomTitleBar', () => {
  it('Windows e Linux desenham a barra; macOS e navegador não', () => {
    expect(hasCustomTitleBar('win32')).toBe(true)
    expect(hasCustomTitleBar('linux')).toBe(true)
    expect(hasCustomTitleBar('darwin')).toBe(false)
    expect(hasCustomTitleBar(undefined)).toBe(false)
  })
})
