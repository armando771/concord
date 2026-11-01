-- Badge "Reações" (internal/badge, categoria "reacoes"): agora conta as
-- mensagens DISTINTAS em que a pessoa reagiu. Várias reações dela na mesma
-- mensagem valem 1 (antes cada emoji contava, e dava para farmar o badge
-- enchendo uma mensagem só de emojis).
--   - O valor sai de um COUNT(DISTINCT message_id) em message_reactions
--     (repository.go), pelo índice abaixo; o contador por trigger de 000038
--     sai, junto com a coluna reactions_given.
--   - Tirar uma reação desconta só quando era a última da pessoa naquela
--     mensagem (a linha some); tirar e pôr de novo na mesma mensagem nunca
--     passa de 1. Mensagem apagada leva as reações junto e desconta, como antes.
--   - A própria mensagem da pessoa continua contando, como antes.
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_message
    ON message_reactions (user_id, message_id);

DROP TRIGGER IF EXISTS message_reactions_badge_count ON message_reactions;
DROP FUNCTION IF EXISTS badge_count_reaction();
ALTER TABLE user_badge_stats DROP COLUMN IF EXISTS reactions_given;

-- Retroativo (só nesta correção, só nesta categoria): quem tem tier gravado
-- acima do que a contagem nova dá perde os tiers a mais. É a exceção à regra
-- "tier gravado não se perde". Nada é concedido aqui (sem aviso de
-- desbloqueio); quem ficou com direito a mais ganha na próxima avaliação.
-- Mesmos limites de catalog_base.go.
WITH valor AS (
    SELECT g.user_id,
           (SELECT COUNT(DISTINCT r.message_id) FROM message_reactions r WHERE r.user_id = g.user_id) AS n
    FROM (SELECT DISTINCT user_id FROM user_badges WHERE category = 'reacoes') g
),
direito AS (
    SELECT v.user_id, COALESCE(MAX(t.tier), 0) AS tier
    FROM valor v
    LEFT JOIN (VALUES (1, 50), (2, 500), (3, 2000)) AS t (tier, threshold)
        ON v.n >= t.threshold
    GROUP BY v.user_id
)
DELETE FROM user_badges b
USING direito d
WHERE b.category = 'reacoes' AND b.user_id = d.user_id AND b.tier > d.tier;
