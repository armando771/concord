-- Badge "Primeira mensagem" (internal/badge, categoria "primeira"): quem
-- mandou a primeira mensagem de um servidor, em qualquer canal de texto.
-- Mensagem do sistema (boas-vindas, Maestro) e de bot não contam. Um dono por
-- servidor (a chave primária garante, mesmo com mensagens ao mesmo tempo).
-- Sem FK para servers: servidor apagado não tira a conquista de ninguém.
CREATE TABLE IF NOT EXISTS server_first_messages (
    server_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message_id UUID NULL,
    sent_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_server_first_messages_user ON server_first_messages (user_id);

-- Servidores que já existem: a mensagem mais antiga que ainda está no banco
-- (se a primeira foi apagada, fica a seguinte).
INSERT INTO server_first_messages (server_id, user_id, message_id, sent_at)
SELECT DISTINCT ON (c.server_id) c.server_id, m.author_id, m.id, m.created_at
FROM messages m
JOIN channels c ON c.id = m.channel_id AND c.type = 'text'
JOIN users u ON u.id = m.author_id AND NOT u.is_bot
WHERE m.system_kind IS NULL
ORDER BY c.server_id, m.created_at, m.id
ON CONFLICT DO NOTHING;

-- Tiers já alcançados, com a data da primeira mensagem que completou cada um
-- (sem aviso de desbloqueio). Mesmos limites de catalog.go.
INSERT INTO user_badges (user_id, category, tier, unlocked_at)
SELECT n.user_id, 'primeira', t.tier, n.sent_at
FROM (
    SELECT user_id, sent_at,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY sent_at, server_id) AS nth
    FROM server_first_messages
) n
JOIN (VALUES (1, 1), (2, 3), (3, 10)) AS t (tier, threshold)
    ON n.nth = t.threshold
ON CONFLICT DO NOTHING;

-- Servidores novos: a primeira mensagem grava o dono na hora. Depois disso,
-- cada mensagem de canal custa só uma busca pela chave primária.
CREATE OR REPLACE FUNCTION badge_first_message() RETURNS trigger AS $$
DECLARE
    sid UUID;
BEGIN
    SELECT c.server_id INTO sid FROM channels c WHERE c.id = NEW.channel_id AND c.type = 'text';
    IF sid IS NULL OR EXISTS (SELECT 1 FROM server_first_messages WHERE server_id = sid) THEN
        RETURN NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM users WHERE id = NEW.author_id AND is_bot) THEN
        RETURN NULL;
    END IF;
    INSERT INTO server_first_messages (server_id, user_id, message_id, sent_at)
    VALUES (sid, NEW.author_id, NEW.id, NEW.created_at)
    ON CONFLICT (server_id) DO NOTHING;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_badge_first ON messages;
CREATE TRIGGER messages_badge_first
AFTER INSERT ON messages
FOR EACH ROW
WHEN (NEW.channel_id IS NOT NULL AND NEW.system_kind IS NULL)
EXECUTE FUNCTION badge_first_message();
