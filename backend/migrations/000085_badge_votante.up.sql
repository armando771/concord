-- Badge "Votante" (internal/badge, categoria "votante"): votos nos cards do
-- quadro de propostas. O número vem de um COUNT na hora, pelo índice abaixo;
-- trocar o voto atualiza a mesma linha e não conta de novo.
CREATE INDEX IF NOT EXISTS idx_proposal_votes_user ON proposal_votes (user_id);

-- Tiers de quem já votou, com a data do voto que alcançou cada um (o N-ésimo
-- voto, na ordem), sem aviso de desbloqueio. Mesmos limites de catalog.go.
INSERT INTO user_badges (user_id, category, tier, unlocked_at)
SELECT n.user_id, 'votante', t.tier, n.created_at
FROM (
    SELECT user_id, created_at,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, proposal_id) AS nth
    FROM proposal_votes
) n
JOIN (VALUES (1, 1), (2, 10), (3, 30), (4, 75), (5, 150)) AS t (tier, threshold)
    ON n.nth = t.threshold
ON CONFLICT DO NOTHING;
