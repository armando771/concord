import type { ChangelogRelease } from '../api/changelog'

export function groupEntries(release: ChangelogRelease): { features: string[]; fixes: string[] } {
  const features: string[] = []
  const fixes: string[] = []
  for (const e of release.entries) (e.kind === 'feature' ? features : fixes).push(e.text)
  return { features, fixes }
}

export function formatReleaseDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  })
}
