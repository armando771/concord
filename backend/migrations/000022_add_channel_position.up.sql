-- Ordem dos canais na barra lateral, por servidor e tipo (texto e voz são
-- seções separadas). Os que já existem ficam na ordem de antes (criação).
ALTER TABLE channels
    ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

UPDATE channels AS c
SET position = o.rn
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY server_id, type ORDER BY created_at, name) - 1 AS rn
    FROM channels
) AS o
WHERE c.id = o.id;

CREATE INDEX idx_channels_server_position ON channels (server_id, type, position);
