-- Conta real passa a ser só quem não é bot e confirmou o e-mail: sem prazo de
-- idade da conta (eram 24 horas na 000165). A mesma regra vale no Festeiro e
-- no Amigos (internal/badge, contaRealSQL, que contareal_test.go confere
-- contra esta função).
--
-- Sem retroativo: o XP do nível do servidor que ficou de fora não volta; o
-- Amigos concede o que faltar na avaliação normal.
CREATE OR REPLACE FUNCTION server_level_real(p_user UUID) RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = p_user
          AND NOT u.is_bot
          AND u.email_verified_at IS NOT NULL
    )
$$ LANGUAGE sql STABLE;
