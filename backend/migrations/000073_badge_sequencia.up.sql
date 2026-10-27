-- Badge "Sequência" (internal/badge, categoria "sequencia"): dias seguidos
-- usando o app, no horário de Brasília. Daqui em diante o backend grava um dia
-- de uso para quem está online (uma vez por pessoa por dia): o dia seguinte ao
-- último soma na sequência e um buraco recomeça do 1. O tier vem da maior
-- sequência já feita.
ALTER TABLE user_badge_stats
    ADD COLUMN IF NOT EXISTS active_last_day DATE NULL,
    ADD COLUMN IF NOT EXISTS streak_days INT NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
    ADD COLUMN IF NOT EXISTS longest_streak_days INT NOT NULL DEFAULT 0 CHECK (longest_streak_days >= 0);

-- Ponto de partida pelo que já está no banco: dia com mensagem, reação, call,
-- proposta, voto ou login conta como dia de uso (abrir o app sem fazer nada
-- disso não ficava registrado). Fica a sequência mais recente e a maior.
WITH dias AS (
    SELECT DISTINCT e.user_id, (e.at AT TIME ZONE 'America/Sao_Paulo')::date AS dia
    FROM (
        SELECT author_id AS user_id, created_at AS at FROM messages WHERE system_kind IS NULL
        UNION ALL SELECT user_id, created_at FROM message_reactions
        UNION ALL SELECT user_id, joined_at FROM call_participants
        UNION ALL SELECT author_id, created_at FROM proposals
        UNION ALL SELECT user_id, created_at FROM proposal_votes
        UNION ALL SELECT user_id, created_at FROM refresh_tokens
    ) e
    JOIN users u ON u.id = e.user_id AND NOT u.is_bot
),
sequencias AS (
    SELECT user_id, MAX(dia) AS fim, COUNT(*)::int AS dias
    FROM (SELECT user_id, dia, dia - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY dia))::int AS grupo FROM dias) d
    GROUP BY user_id, grupo
)
INSERT INTO user_badge_stats (user_id, active_last_day, streak_days, longest_streak_days)
SELECT DISTINCT ON (user_id) user_id, fim, dias, MAX(dias) OVER (PARTITION BY user_id)
FROM sequencias
ORDER BY user_id, fim DESC
ON CONFLICT (user_id) DO UPDATE SET
    active_last_day = EXCLUDED.active_last_day,
    streak_days = EXCLUDED.streak_days,
    longest_streak_days = GREATEST(user_badge_stats.longest_streak_days, EXCLUDED.longest_streak_days)
WHERE user_badge_stats.active_last_day IS NULL OR user_badge_stats.active_last_day <= EXCLUDED.active_last_day;

-- Tiers já alcançados, no dia em que a sequência chegou ao limite (meia-noite
-- de Brasília), sem aviso de desbloqueio. Mesmos limites de catalog.go.
WITH dias AS (
    SELECT DISTINCT e.user_id, (e.at AT TIME ZONE 'America/Sao_Paulo')::date AS dia
    FROM (
        SELECT author_id AS user_id, created_at AS at FROM messages WHERE system_kind IS NULL
        UNION ALL SELECT user_id, created_at FROM message_reactions
        UNION ALL SELECT user_id, joined_at FROM call_participants
        UNION ALL SELECT author_id, created_at FROM proposals
        UNION ALL SELECT user_id, created_at FROM proposal_votes
        UNION ALL SELECT user_id, created_at FROM refresh_tokens
    ) e
    JOIN users u ON u.id = e.user_id AND NOT u.is_bot
),
sequencias AS (
    SELECT user_id, MIN(dia) AS inicio, COUNT(*)::int AS dias
    FROM (SELECT user_id, dia, dia - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY dia))::int AS grupo FROM dias) d
    GROUP BY user_id, grupo
)
INSERT INTO user_badges (user_id, category, tier, unlocked_at)
SELECT s.user_id, 'sequencia', t.tier, MIN((s.inicio + (t.threshold - 1))::timestamp AT TIME ZONE 'America/Sao_Paulo')
FROM sequencias s
JOIN (VALUES (1, 3), (2, 7), (3, 30), (4, 100), (5, 365)) AS t (tier, threshold)
    ON s.dias >= t.threshold
GROUP BY s.user_id, t.tier
ON CONFLICT DO NOTHING;
