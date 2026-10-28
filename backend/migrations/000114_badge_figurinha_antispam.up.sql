-- Badge "Figurinha" (internal/badge, categoria "figurinha"): spam não conta
-- mais, com as regras de Mensagens (000113).
--   - A mesma figurinha ou o mesmo GIF da mensagem anterior da pessoa na
--     mesma sala, mandada menos de 1 hora antes, não conta (para Mensagens só
--     não conta se a mensagem inteira for igual).
--   - Apagada até 2 minutos depois de enviada desconta, se tinha contado.
CREATE OR REPLACE FUNCTION badge_sticker_repeats(m messages) RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM badge_message_previous(m) p
        WHERE p.sticker_id = m.sticker_id OR p.gif_url = m.gif_url
    )
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION badge_count_sticker() RETURNS trigger AS $$
BEGIN
    IF NOT badge_sticker_repeats(NEW) THEN
        INSERT INTO user_badge_stats (user_id, stickers_sent) VALUES (NEW.author_id, 1)
        ON CONFLICT (user_id) DO UPDATE SET
            stickers_sent = user_badge_stats.stickers_sent + 1,
            updated_at = NOW();
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION badge_uncount_sticker() RETURNS trigger AS $$
BEGIN
    IF NOT badge_sticker_repeats(OLD) THEN
        UPDATE user_badge_stats
        SET stickers_sent = GREATEST(stickers_sent - 1, 0), updated_at = NOW()
        WHERE user_id = OLD.author_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_badge_uncount_sticker ON messages;
CREATE TRIGGER messages_badge_uncount_sticker
BEFORE DELETE ON messages
FOR EACH ROW
WHEN (OLD.system_kind IS NULL AND (OLD.sticker_id IS NOT NULL OR OLD.gif_url IS NOT NULL)
      AND OLD.created_at > NOW() - INTERVAL '2 minutes')
EXECUTE FUNCTION badge_uncount_sticker();

-- Retroativo (só nesta correção, só nesta categoria). Mensagem apagada some
-- do banco, então não dá para saber quais foram apagadas em até 2 minutos: a
-- conta nova usa só as que ainda existem, descontando as repetições seguidas
-- como o trigger, e o contador nunca sobe (LEAST).
WITH ordenadas AS (
    SELECT m.author_id, m.created_at, m.sticker_id, m.gif_url,
           LAG(m.sticker_id) OVER w AS sticker_antes,
           LAG(m.gif_url) OVER w AS gif_antes,
           LAG(m.created_at) OVER w AS at_antes
    FROM messages m
    WHERE m.system_kind IS NULL
    WINDOW w AS (PARTITION BY m.author_id, m.channel_id, m.conversation_id ORDER BY m.created_at, m.id)
),
valor AS (
    SELECT author_id AS user_id,
           COUNT(*) FILTER (WHERE (sticker_id IS NOT NULL OR gif_url IS NOT NULL) AND NOT COALESCE(
               at_antes > created_at - INTERVAL '1 hour' AND (sticker_antes = sticker_id OR gif_antes = gif_url), FALSE
           )) AS n
    FROM ordenadas
    GROUP BY author_id
)
UPDATE user_badge_stats b
SET stickers_sent = LEAST(b.stickers_sent, COALESCE(v.n, 0)), updated_at = NOW()
FROM user_badge_stats s
LEFT JOIN valor v ON v.user_id = s.user_id
WHERE s.user_id = b.user_id AND b.stickers_sent > 0;

-- Quem tem tier gravado acima do que a conta nova dá perde os tiers a mais,
-- como em 000095. Nada é concedido aqui (sem aviso de desbloqueio). Mesmos
-- limites de catalog_uso.go.
WITH direito AS (
    SELECT g.user_id, COALESCE(MAX(t.tier), 0) AS tier
    FROM (SELECT DISTINCT user_id FROM user_badges WHERE category = 'figurinha') g
    LEFT JOIN user_badge_stats s ON s.user_id = g.user_id
    LEFT JOIN (VALUES (1, 10), (2, 100), (3, 500), (4, 2000)) AS t (tier, threshold)
        ON COALESCE(s.stickers_sent, 0) >= t.threshold
    GROUP BY g.user_id
)
DELETE FROM user_badges b
USING direito d
WHERE b.category = 'figurinha' AND b.user_id = d.user_id AND b.tier > d.tier;
