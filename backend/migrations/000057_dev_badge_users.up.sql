-- Devs do Salinha: quem está aqui ganha o badge mítico "Criador da Salinha"
-- (internal/badge, categoria "criador"). Começa vazia; para conceder, veja
-- docs/HOSPEDAGEM.md ("Badge Criador da Salinha"). Tirar a linha tira o
-- badge, mesmo já gravado em user_badges.
CREATE TABLE dev_badge_users (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
