-- Posição dos canais dentro de cada seção (texto / voz) do servidor.
ALTER TABLE channels
  ADD COLUMN position INT NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY server_id, type ORDER BY created_at, name, id) - 1 AS pos
  FROM channels
)
UPDATE channels c
SET position = ranked.pos
FROM ranked
WHERE c.id = ranked.id;
