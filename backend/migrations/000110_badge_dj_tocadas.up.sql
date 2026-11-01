-- Badge "DJ" (internal/badge, categoria "dj"): agora conta só a música que
-- tocou de verdade, por pelo menos 30 s e com mais alguém ouvindo na call
-- (internal/music/played.go). Antes contava cada música posta na fila, e uma
-- playlist de 5000 dava o tier máximo. A coluna muda de nome junto.
ALTER TABLE user_badge_stats RENAME COLUMN songs_queued TO songs_played;

-- Retroativo (só nesta correção, só nesta categoria). O banco não guarda o
-- que tocou nem quem ouvia, só os avisos do Maestro no chat ("🎵 @fulano
-- adicionou ..."). Conta conservadora: cada aviso vale 1, seja uma música ou
-- uma playlist inteira, e o contador nunca sobe (LEAST com o que já tinha).
WITH pedidos AS (
    SELECT u.id AS user_id, COUNT(*) AS n
    FROM messages m
    JOIN users u ON u.username = substring(m.content FROM '^🎵 @(\S+) adicionou ')
    WHERE m.system_kind = 'music'
    GROUP BY u.id
)
UPDATE user_badge_stats b
SET songs_played = LEAST(b.songs_played, COALESCE(p.n, 0)), updated_at = NOW()
FROM user_badge_stats s
LEFT JOIN pedidos p ON p.user_id = s.user_id
WHERE s.user_id = b.user_id AND b.songs_played > 0;

-- Quem tem tier gravado acima do que a conta nova dá perde os tiers a mais
-- (como em 000095). Nada é concedido aqui, então não há aviso de desbloqueio.
-- Mesmos limites de catalog_uso.go.
WITH direito AS (
    SELECT g.user_id, COALESCE(MAX(t.tier), 0) AS tier
    FROM (SELECT DISTINCT user_id FROM user_badges WHERE category = 'dj') g
    LEFT JOIN user_badge_stats s ON s.user_id = g.user_id
    LEFT JOIN (VALUES (1, 10), (2, 50), (3, 200), (4, 1000), (5, 5000)) AS t (tier, threshold)
        ON COALESCE(s.songs_played, 0) >= t.threshold
    GROUP BY g.user_id
)
DELETE FROM user_badges b
USING direito d
WHERE b.category = 'dj' AND b.user_id = d.user_id AND b.tier > d.tier;
