-- Badge "Contribuinte" (internal/badge, categoria "contribuinte"): conta os
-- cards do quadro de propostas que a pessoa criou e que ainda existem, até os
-- rejeitados. O número vem de um COUNT na hora; aqui só se gravam os tiers de
-- quem já tinha cards, com a data do card que alcançou cada um (o N-ésimo
-- card, na ordem de criação) em vez do dia do deploy. Esses tiers entram sem
-- aviso de desbloqueio. Mesmos limites de catalog.go (1, 5, 15, 40, 100).
INSERT INTO user_badges (user_id, category, tier, unlocked_at)
SELECT n.author_id, 'contribuinte', t.tier, n.created_at
FROM (
    SELECT author_id, created_at,
           ROW_NUMBER() OVER (PARTITION BY author_id ORDER BY created_at, id) AS nth
    FROM proposals
) n
JOIN (VALUES (1, 1), (2, 5), (3, 15), (4, 40), (5, 100)) AS t (tier, threshold)
    ON n.nth = t.threshold
ON CONFLICT DO NOTHING;
