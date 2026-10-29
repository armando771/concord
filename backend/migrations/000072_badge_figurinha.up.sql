-- Badge "Figurinha" (internal/badge, categoria "figurinha"): mensagens com
-- figurinha ou GIF, contadas por trigger como as mensagens (000038). Mensagem
-- apagada não desconta; mensagem do sistema não conta.
ALTER TABLE user_badge_stats
    ADD COLUMN IF NOT EXISTS stickers_sent BIGINT NOT NULL DEFAULT 0 CHECK (stickers_sent >= 0);

-- Contagem inicial do que já existe. Figurinha apagada do servidor some da
-- mensagem (sticker_id vira NULL), então essas não entram.
INSERT INTO user_badge_stats (user_id, stickers_sent)
SELECT author_id, COUNT(*) FROM messages
WHERE system_kind IS NULL AND (sticker_id IS NOT NULL OR gif_url IS NOT NULL)
GROUP BY author_id
ON CONFLICT (user_id) DO UPDATE SET stickers_sent = EXCLUDED.stickers_sent;

-- Tiers já alcançados, com a data da mensagem que cruzou o limite (sem aviso
-- de desbloqueio). Mesmos limites de catalog.go.
INSERT INTO user_badges (user_id, category, tier, unlocked_at)
SELECT n.author_id, 'figurinha', t.tier, n.created_at
FROM (
    SELECT author_id, created_at,
           ROW_NUMBER() OVER (PARTITION BY author_id ORDER BY created_at, id) AS nth
    FROM messages
    WHERE system_kind IS NULL AND (sticker_id IS NOT NULL OR gif_url IS NOT NULL)
) n
JOIN (VALUES (1, 10), (2, 100), (3, 500), (4, 2000)) AS t (tier, threshold)
    ON n.nth = t.threshold
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION badge_count_sticker() RETURNS trigger AS $$
BEGIN
    INSERT INTO user_badge_stats (user_id, stickers_sent) VALUES (NEW.author_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET
        stickers_sent = user_badge_stats.stickers_sent + 1,
        updated_at = NOW();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- O WHEN deixa as mensagens comuns sem custo extra.
DROP TRIGGER IF EXISTS messages_badge_stickers ON messages;
CREATE TRIGGER messages_badge_stickers
AFTER INSERT ON messages
FOR EACH ROW
WHEN (NEW.system_kind IS NULL AND (NEW.sticker_id IS NOT NULL OR NEW.gif_url IS NOT NULL))
EXECUTE FUNCTION badge_count_sticker();
