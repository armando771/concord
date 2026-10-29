-- Conta real passa a ser: não é bot, tem e-mail confirmado e a conta foi
-- criada há 24 horas ou mais (era 7 dias; o Salinha ainda não tinha nenhuma
-- conta com 7 dias e o nível dos servidores ficava travado em 0). A mesma
-- regra vale no Festeiro e no Amigos (internal/badge ContaRealHoras, que
-- contareal_test.go confere contra este prazo).
--
-- Sem retroativo do nível do servidor: o XP que já ficou de fora não volta, a
-- conta nova passa a contar daqui para a frente.
CREATE OR REPLACE FUNCTION server_level_real(p_user UUID) RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = p_user
          AND NOT u.is_bot
          AND u.email_verified_at IS NOT NULL
          AND u.created_at <= NOW() - INTERVAL '24 hours'
    )
$$ LANGUAGE sql STABLE;
