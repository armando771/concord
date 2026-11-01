-- O deploy republicava todo o changelog/next.md acumulado em cada versão nova
-- (o arquivo só era esvaziado no runner do CI). Cada nota fica só na release
-- mais antiga que a trouxe; as cópias nas mais novas saem.
DELETE FROM changelog_entries e
USING changelog_releases re, changelog_entries o, changelog_releases ro
WHERE re.id = e.release_id
  AND ro.id = o.release_id
  AND o.text = e.text
  AND (ro.released_at, ro.id) < (re.released_at, re.id);
