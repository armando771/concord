-- Canal de sistema "bot": onde o Maestro posta. Não pode ser editado nem
-- removido, só movido. Um por servidor.
ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Servidor que já tem um canal de texto chamado "bot" adota ele como o de sistema.
UPDATE channels SET is_system = TRUE WHERE name = 'bot' AND type = 'text' AND is_system = FALSE;

INSERT INTO channels (server_id, name, type, position, created_by, is_system)
SELECT
    s.id,
    'bot',
    'text',
    (SELECT COALESCE(MAX(c.position) + 1, 0) FROM channels c WHERE c.server_id = s.id AND c.type = 'text'),
    s.owner_id,
    TRUE
FROM servers s
WHERE NOT EXISTS (SELECT 1 FROM channels c WHERE c.server_id = s.id AND c.is_system);

CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_one_system_per_server ON channels (server_id) WHERE is_system;
