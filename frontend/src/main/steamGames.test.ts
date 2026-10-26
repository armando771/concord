import { describe, expect, it } from 'vitest'
import {
  findIconHash,
  parseAppManifestName,
  parseLibraryFolders,
  parseRunningAppId,
  parseSteamPath
} from './steamGames'

describe('parseRunningAppId', () => {
  it('lê o appid em hexadecimal', () => {
    const out =
      '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    RunningAppID    REG_DWORD    0x289bb4\r\n\r\n'
    expect(parseRunningAppId(out)).toBe(2661300)
  })

  it('devolve 0 sem jogo ou sem a chave', () => {
    expect(parseRunningAppId('    RunningAppID    REG_DWORD    0x0')).toBe(0)
    expect(parseRunningAppId('')).toBe(0)
  })
})

describe('parseSteamPath', () => {
  it('lê a pasta da Steam', () => {
    const out = '    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n'
    expect(parseSteamPath(out)).toBe('c:/program files (x86)/steam')
  })

  it('devolve undefined sem a chave', () => {
    expect(parseSteamPath('')).toBeUndefined()
  })
})

describe('parseLibraryFolders', () => {
  it('lista as bibliotecas e desfaz as barras duplas', () => {
    const vdf = `"libraryfolders"
{
\t"0"
\t{
\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"
\t\t"apps"
\t\t{
\t\t\t"228980"\t\t"161614178"
\t\t}
\t}
\t"1"
\t{
\t\t"path"\t\t"D:\\\\SteamLibrary"
\t}
}`
    expect(parseLibraryFolders(vdf)).toEqual(['C:\\Program Files (x86)\\Steam', 'D:\\SteamLibrary'])
  })
})

describe('findIconHash', () => {
  const hash = '0e56e01c18bf303a65ba60dddfa842cc85d1da33'

  it('acha o jpg com nome sha1 entre os arquivos do appid', () => {
    expect(findIconHash(['logo.png', `${hash.toUpperCase()}.jpg`, 'header.jpg'])).toBe(hash)
  })

  it('devolve undefined sem o ícone', () => {
    expect(findIconHash(['header.jpg', 'library_600x900.jpg', 'abc'])).toBeUndefined()
  })
})

describe('parseAppManifestName', () => {
  it('lê o título do manifest', () => {
    const acf = '"AppState"\n{\n\t"appid"\t\t"2661300"\n\t"name"\t\t"Grounded 2"\n}'
    expect(parseAppManifestName(acf)).toBe('Grounded 2')
  })

  it('devolve undefined sem nome', () => {
    expect(parseAppManifestName('"AppState"\n{\n}')).toBeUndefined()
  })
})
