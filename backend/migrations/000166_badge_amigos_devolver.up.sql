-- Badge "Amigos" (internal/badge, categoria "amigos"): devolve os tiers que a
-- 000112 apagou. Aquela migration passou a exigir 7 dias de conta dos amigos
-- e, como o Salinha ainda não tinha nenhuma conta com 7 dias, rebaixou todo
-- mundo. Com a conta real em 24 horas (000165), o valor de cada pessoa é
-- recalculado e os tiers a que ela tem direito são gravados de novo.
--
-- Só esta categoria, e só concede (nada é apagado, tier já gravado fica com a
-- data que tinha). A data original dos tiers apagados se perdeu: os devolvidos
-- levam unlocked_at = agora. Sem aviso de desbloqueio: o aviso só sai de tier
-- novo na avaliação (SaveUnlocks), e estes já estão gravados quando ela roda.
-- Mesmos limites de catalog_base.go.
WITH amizades AS (
    SELECT f.requester_id AS user_id, f.addressee_id AS outro FROM friendships f WHERE f.status = 'accepted'
    UNION ALL
    SELECT f.addressee_id, f.requester_id FROM friendships f WHERE f.status = 'accepted'
),
valor AS (
    SELECT a.user_id, COUNT(*) AS n
    FROM amizades a
    JOIN users o ON o.id = a.outro
    WHERE NOT o.is_bot AND o.email_verified_at IS NOT NULL AND o.created_at <= NOW() - INTERVAL '24 hours'
    GROUP BY a.user_id
)
INSERT INTO user_badges (user_id, category, tier, unlocked_at)
SELECT v.user_id, 'amigos', t.tier, NOW()
FROM valor v
JOIN (VALUES (1, 5), (2, 15), (3, 30), (4, 50), (5, 100)) AS t (tier, threshold)
    ON v.n >= t.threshold
ON CONFLICT DO NOTHING;
