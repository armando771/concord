// Próxima versão do app: um patch acima da maior entre a do package.json e a
// já publicada no servidor — sempre sobe, de onde quer que se publique.
//
//   node scripts/next-version.mjs <versão-publicada|-> <versão-do-package.json>
const parse = (v) => (/^\d+\.\d+\.\d+$/.test(v ?? '') ? v.split('.').map(Number) : null)
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

export function nextVersion(published, local) {
  const candidates = [parse(published), parse(local)].filter(Boolean)
  if (candidates.length === 0) throw new Error('nenhuma versão válida')
  const [major, minor, patch] = candidates.sort(cmp).at(-1)
  return `${major}.${minor}.${patch + 1}`
}

if (process.argv[1]?.endsWith('next-version.mjs')) {
  console.log(nextVersion(process.argv[2], process.argv[3]))
}
