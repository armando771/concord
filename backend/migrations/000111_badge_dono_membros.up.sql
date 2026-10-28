-- Badge "Dono de servidor" (internal/badge, categoria "dono"): só conta o
-- servidor com pelo menos 3 membros além do dono, sem contar bots
-- (donoMinMembers em repository.go). Antes contava todo servidor criado, e dava
-- para subir o badge criando servidores vazios. O valor sai de um COUNT na
-- hora (Stats), então membro novo passa a contar na próxima avaliação.

-- Retroativo (só nesta correção, só nesta categoria): quem tem tier gravado
-- acima do que a regra nova dá perde os tiers a mais, como em 000095. Nada é
-- concedido aqui (sem aviso de desbloqueio). Mesmos limites de catalog_base.go.
WITH valor AS (
    SELECT g.user_id,
           (SELECT COUNT(*) FROM servers sv WHERE sv.owner_id = g.user_id AND (
                SELECT COUNT(*) FROM server_members sm JOIN users mu ON mu.id = sm.user_id AND NOT mu.is_bot
                WHERE sm.server_id = sv.id AND sm.user_id <> sv.owner_id
            ) >= 3) AS n
    FROM (SELECT DISTINCT user_id FROM user_badges WHERE category = 'dono') g
),
direito AS (
    SELECT v.user_id, COALESCE(MAX(t.tier), 0) AS tier
    FROM valor v
    LEFT JOIN (VALUES (1, 1), (2, 3), (3, 5)) AS t (tier, threshold)
        ON v.n >= t.threshold
    GROUP BY v.user_id
)
DELETE FROM user_badges b
USING direito d
WHERE b.category = 'dono' AND b.user_id = d.user_id AND b.tier > d.tier;
