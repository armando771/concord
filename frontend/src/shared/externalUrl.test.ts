import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl } from './externalUrl'

describe('isSafeExternalUrl', () => {
  it('só http e https, com host', () => {
    expect(isSafeExternalUrl('https://exemplo.com/a?b=1')).toBe(true)
    expect(isSafeExternalUrl('http://exemplo.com')).toBe(true)
    expect(isSafeExternalUrl('HTTPS://EXEMPLO.COM')).toBe(true)
  })

  it('recusa outros esquemas e lixo', () => {
    for (const url of [
      'javascript:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'smb://servidor/share',
      'ms-settings:privacy',
      'vbscript:msgbox',
      'mailto:a@b.com',
      'https://',
      'não é url',
      ''
    ]) {
      expect(isSafeExternalUrl(url), url).toBe(false)
    }
  })
})
