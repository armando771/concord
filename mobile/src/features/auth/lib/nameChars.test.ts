import { nameCharsError } from './nameChars'

// Os mesmos casos de backend/internal/user/name_test.go.
describe('nameCharsError', () => {
  it('aceita nomes comuns, acentos, outras escritas e emoji (ZWJ entre emoji)', () => {
    for (const name of [
      'Ana',
      'Ana Souza',
      'João Ção',
      '🎮',
      '👨\u{200d}👩\u{200d}👧',
      '🏳\u{fe0f}\u{200d}🌈',
      '👩🏽\u{200d}💻',
      '❤\u{fe0f}',
      '1\u{fe0f}\u{20e3}',
      'e\u{301}',
      '李小龍',
      'Ελένη',
      'محمد',
      'ㅎㅎ'
    ]) {
      expect(nameCharsError(name)).toBeNull()
    }
  })

  it('recusa invisíveis, controle (NUL incluso) e bidi', () => {
    for (const name of [
      'a\u{200b}b',
      '\u{200b}',
      'a\u{200c}b',
      'a\u{2060}b',
      '\u{feff}Ana',
      'a\u{ad}b',
      'a\u{202e}b',
      '\u{202a}Ana',
      'Ana\u{202c}',
      'a\u{2067}b',
      'a\u{2069}b',
      'a\u{61c}b',
      'a\u{0}b',
      '\u{0}',
      'a\nb',
      'a\tb',
      'a\u{7f}b',
      'a\u{85}b',
      'a\u{2028}b',
      'a\u{fffd}b',
      '\u{3164}',
      'a\u{3164}b',
      '\u{115f}',
      '\u{1160}',
      '\u{ffa0}',
      '\u{2800}',
      'a\u{200d}b',
      '\u{200d}🎮',
      'a\u{fe0f}',
      'a\u{34f}b'
    ]) {
      expect(nameCharsError(name)).toBe('invalid')
    }
  })

  it('sem nada visível (só marca combinante ou espaço) é "blank"', () => {
    for (const name of ['\u{301}', '\u{301}\u{302}', '\u{a0}', ' \u{3000} ']) {
      expect(nameCharsError(name)).toBe('blank')
    }
  })
})
