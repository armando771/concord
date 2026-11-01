-- Badge "Amigos" (internal/badge, categoria "amigos"): só conta amizade
-- aceita com conta real, de e-mail confirmado e criada há pelo menos 7 dias
-- (amigoContaRealDias em repository.go). Antes contava qualquer amizade, e dava
-- para subir o badge com contas criadas só para aceitar o pedido. O valor sai
-- de um COUNT na hora (Stats): o amigo que vira conta real depois passa a
-- contar na próxima avaliação.

-- Retroativo (só nesta correção, só nesta categoria): quem tem tier gravado
-- acima do que a regra nova dá perde os tiers a mais, como em 000095. Nada é
-- concedido aqui (sem aviso de desbloqueio). Mesmos limites de catalog_base.go.
WITH valor AS (
    SELECT g.user_id,
           (SELECT COUNT(*) FROM friendships f
            JOIN users o ON o.id = CASE WHEN f.requester_id = g.user_id THEN f.addressee_id ELSE f.requester_id END
            WHERE (f.requester_id = g.user_id OR f.addressee_id = g.user_id) AND f.status = 'accepted'
            AND o.email_verified_at IS NOT NULL AND o.created_at <= NOW() - make_interval(days => 7)) AS n
    FROM (SELECT DISTINCT user_id FROM user_badges WHERE category = 'amigos') g
),
direito AS (
    SELECT v.user_id, COALESCE(MAX(t.tier), 0) AS tier
    FROM valor v
    LEFT JOIN (VALUES (1, 5), (2, 15), (3, 30), (4, 50), (5, 100)) AS t (tier, threshold)
        ON v.n >= t.threshold
    GROUP BY v.user_id
)
DELETE FROM user_badges b
USING direito d
WHERE b.category = 'amigos' AND b.user_id = d.user_id AND b.tier > d.tier;
