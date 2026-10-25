// Detecta o SO do visitante para destacar o download certo.
// Retorna 'windows', 'linux' ou 'other' (macOS, celular, ChromeOS, desconhecido).
export function detectOS(platform, userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  if (/android|iphone|ipad|ipod|cros|mobile/.test(ua)) return 'other';
  const p = String(platform || '').toLowerCase();
  if (p) {
    if (p.startsWith('win')) return 'windows';
    if (p.includes('linux')) return 'linux';
    return 'other';
  }
  if (/windows nt|win32|win64/.test(ua)) return 'windows';
  if (/linux|x11/.test(ua)) return 'linux';
  return 'other';
}
