-- Badge "DJ" (internal/badge, categoria "dj"): músicas que a pessoa pôs na
-- fila do Maestro (internal/music). Daqui em diante o backend soma a cada
-- pedido (a playlist conta cada música que entrou).
ALTER TABLE user_badge_stats
    ADD COLUMN IF NOT EXISTS songs_queued BIGINT NOT NULL DEFAULT 0 CHECK (songs_queued >= 0);

-- Contagem inicial pelos avisos públicos do Maestro ("🎵 @fulano adicionou
-- ..."), que guardam o @ de quem pediu: quem trocou de @ depois não leva os
-- pedidos antigos. Os tiers já alcançados entram com a data do aviso que
-- cruzou o limite, sem aviso de desbloqueio. Mesmos limites de catalog.go.
WITH pedidos AS (
    SELECT u.id AS user_id, m.created_at, m.id,
           COALESCE(substring(m.content FROM '^🎵 @\S+ adicionou a playlist .*\((\d+) músicas, ~')::bigint, 1) AS n
    FROM messages m
    JOIN users u ON u.username = substring(m.content FROM '^🎵 @(\S+) adicionou ')
    WHERE m.system_kind = 'music'
)
INSERT INTO user_badge_stats (user_id, songs_queued)
SELECT user_id, SUM(n) FROM pedidos GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE SET songs_queued = EXCLUDED.songs_queued;

WITH pedidos AS (
    SELECT u.id AS user_id, m.created_at, m.id,
           COALESCE(substring(m.content FROM '^🎵 @\S+ adicionou a playlist .*\((\d+) músicas, ~')::bigint, 1) AS n
    FROM messages m
    JOIN users u ON u.username = substring(m.content FROM '^🎵 @(\S+) adicionou ')
    WHERE m.system_kind = 'music'
),
acumulado AS (
    SELECT user_id, created_at, SUM(n) OVER (PARTITION BY user_id ORDER BY created_at, id) AS total
    FROM pedidos
)
INSERT INTO user_badges (user_id, category, tier, unlocked_at)
SELECT a.user_id, 'dj', t.tier, MIN(a.created_at)
FROM acumulado a
JOIN (VALUES (1, 10), (2, 50), (3, 200), (4, 1000), (5, 5000)) AS t (tier, threshold)
    ON a.total >= t.threshold
GROUP BY a.user_id, t.tier
ON CONFLICT DO NOTHING;
