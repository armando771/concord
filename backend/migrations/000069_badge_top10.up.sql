-- Badge Top 10 do Nível 100: os 10 primeiros a chegar no nível 100, na
-- ordem de chegada. A vaga é dada pelo backend (internal/badge/top10.go)
-- com uma trava por transação; a tabela também não aceita mais de 10 nem
-- posição repetida. Conta apagada não devolve a vaga (user_id vira NULL).
CREATE TABLE badge_top10 (
    posicao SMALLINT PRIMARY KEY CHECK (posicao BETWEEN 1 AND 10),
    user_id UUID UNIQUE REFERENCES users (id) ON DELETE SET NULL,
    reached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quem já está no nível 100 entra pela data em que o badge Nível chegou ao
-- tier 5 (Imortal, nível 100); empate (todos gravados no mesmo deploy) vai
-- por mais XP e depois pela conta mais antiga.
INSERT INTO badge_top10 (posicao, user_id, reached_at)
SELECT ROW_NUMBER() OVER (ORDER BY b.unlocked_at, COALESCE(l.xp, 0) DESC, u.created_at, u.id), b.user_id, b.unlocked_at
FROM user_badges b
JOIN users u ON u.id = b.user_id
LEFT JOIN user_levels l ON l.user_id = b.user_id
WHERE b.category = 'nivel' AND b.tier = 5
ORDER BY b.unlocked_at, COALESCE(l.xp, 0) DESC, u.created_at, u.id
LIMIT 10;

-- O badge já sai com o dia em que a pessoa chegou ao nível 100.
INSERT INTO user_badges (user_id, category, tier, unlocked_at)
SELECT user_id, 'top10', 1, reached_at FROM badge_top10
ON CONFLICT DO NOTHING;
