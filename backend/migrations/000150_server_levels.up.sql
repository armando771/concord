-- Nível do servidor (internal/serverlevel, docs/adr/0016-nivel-do-servidor.md).
-- O XP vem só do que as pessoas fazem no servidor: membro novo, mensagens,
-- figurinhas e sons enviados (triggers daqui) e tempo em call, live, live
-- assistida e call cheia (o backend soma em memória e grava pelo
-- server_level_add). Só contas reais contam, com teto diário por pessoa e por
-- fonte.

-- level: o último nível que o backend viu e anunciou. NULL = veio do
-- retroativo e ainda não foi visto (o backend acerta sem aviso de subida).
CREATE TABLE server_levels (
    server_id UUID PRIMARY KEY REFERENCES servers (id) ON DELETE CASCADE,
    xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
    level INT DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- O backend relê só o que mudou há pouco (e o que nunca viu).
CREATE INDEX idx_server_levels_updated ON server_levels (updated_at);

-- XP de cada pessoa, por dia (Brasília) e fonte: é o teto diário e o
-- detalhamento dos últimos 7 dias.
CREATE TABLE server_level_daily (
    server_id UUID NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    day DATE NOT NULL,
    source VARCHAR(16) NOT NULL,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    xp INT NOT NULL DEFAULT 0 CHECK (xp >= 0),
    PRIMARY KEY (server_id, day, source, user_id)
);

-- Quem já rendeu o XP de membro novo (uma vez por pessoa por servidor: sair e
-- voltar não dá de novo).
CREATE TABLE server_level_members (
    server_id UUID NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (server_id, user_id)
);

-- Conta real: não é bot, e-mail confirmado e conta com 7 dias ou mais (a
-- mesma regra do Festeiro e do Amigos, internal/badge amigoContaRealDias).
CREATE FUNCTION server_level_real(p_user UUID) RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = p_user
          AND NOT u.is_bot
          AND u.email_verified_at IS NOT NULL
          AND u.created_at <= NOW() - INTERVAL '7 days'
    )
$$ LANGUAGE sql STABLE;

-- Teto diário de XP de uma pessoa num servidor por fonte (tabela do ADR).
CREATE FUNCTION server_level_cap(p_source TEXT) RETURNS int AS $$
    SELECT CASE p_source
        WHEN 'membros' THEN 50
        WHEN 'mensagens' THEN 100
        WHEN 'figurinhas' THEN 50
        WHEN 'sons' THEN 50
        WHEN 'voz' THEN 120
        WHEN 'live' THEN 60
        WHEN 'espectador' THEN 60
        WHEN 'presenca' THEN 60
        ELSE 0
    END
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION server_level_today() RETURNS date AS $$
    SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
$$ LANGUAGE sql STABLE;

-- Soma (ou desconta, com p_xp < 0) XP de p_user em p_server hoje e devolve o
-- que entrou de fato. Somar respeita a conta real e o teto do dia; descontar
-- só mexe em linhas que já existem (UPDATE, nunca INSERT), para não recriar
-- nada no meio da cascata de um servidor ou usuário sendo apagado.
CREATE FUNCTION server_level_add(p_server UUID, p_user UUID, p_source TEXT, p_xp INT) RETURNS int AS $$
DECLARE
    v_day date := server_level_today();
    v_before int;
    v_after int;
BEGIN
    IF p_xp = 0 OR (p_xp > 0 AND NOT server_level_real(p_user)) THEN
        RETURN 0;
    END IF;
    IF p_xp > 0 THEN
        INSERT INTO server_level_daily (server_id, day, source, user_id)
        VALUES (p_server, v_day, p_source, p_user)
        ON CONFLICT DO NOTHING;
    END IF;
    SELECT xp INTO v_before FROM server_level_daily
    WHERE server_id = p_server AND day = v_day AND source = p_source AND user_id = p_user
    FOR UPDATE;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    v_after := GREATEST(LEAST(v_before + p_xp, server_level_cap(p_source)), 0);
    IF v_after = v_before THEN
        RETURN 0;
    END IF;
    UPDATE server_level_daily SET xp = v_after
    WHERE server_id = p_server AND day = v_day AND source = p_source AND user_id = p_user;
    IF p_xp > 0 THEN
        INSERT INTO server_levels (server_id, xp) VALUES (p_server, v_after - v_before)
        ON CONFLICT (server_id) DO UPDATE SET
            xp = server_levels.xp + EXCLUDED.xp,
            updated_at = NOW();
    ELSE
        UPDATE server_levels SET xp = GREATEST(xp + (v_after - v_before), 0), updated_at = NOW()
        WHERE server_id = p_server;
    END IF;
    RETURN v_after - v_before;
END;
$$ LANGUAGE plpgsql;

-- Mensagens em canal de servidor: as mesmas regras do badge Mensagens (000113):
-- repetida em menos de 1 hora não conta e a apagada em até 2 minutos desconta.
-- Adiado para o fim da transação, como o badge (os anexos entram depois).
CREATE FUNCTION server_level_count_message() RETURNS trigger AS $$
DECLARE
    v_server UUID;
BEGIN
    SELECT server_id INTO v_server FROM channels WHERE id = NEW.channel_id;
    IF v_server IS NOT NULL AND NOT badge_message_repeats(NEW) THEN
        PERFORM server_level_add(v_server, NEW.author_id, 'mensagens', 2);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER messages_server_level_count
AFTER INSERT ON messages
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (NEW.system_kind IS NULL AND NEW.channel_id IS NOT NULL)
EXECUTE FUNCTION server_level_count_message();

CREATE FUNCTION server_level_uncount_message() RETURNS trigger AS $$
DECLARE
    v_server UUID;
BEGIN
    SELECT server_id INTO v_server FROM channels WHERE id = OLD.channel_id;
    IF v_server IS NOT NULL AND NOT badge_message_repeats(OLD) THEN
        PERFORM server_level_add(v_server, OLD.author_id, 'mensagens', -2);
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_server_level_uncount
BEFORE DELETE ON messages
FOR EACH ROW
WHEN (OLD.system_kind IS NULL AND OLD.channel_id IS NOT NULL AND OLD.created_at > NOW() - INTERVAL '2 minutes')
EXECUTE FUNCTION server_level_uncount_message();

-- Figurinha e som enviados ao servidor: 10 XP por item; apagado em até 24 h
-- desconta (enviar e apagar não vira fonte de XP).
CREATE FUNCTION server_level_count_upload() RETURNS trigger AS $$
BEGIN
    PERFORM server_level_add(NEW.server_id, NEW.uploader_id, TG_ARGV[0], 10);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION server_level_uncount_upload() RETURNS trigger AS $$
BEGIN
    PERFORM server_level_add(OLD.server_id, OLD.uploader_id, TG_ARGV[0], -10);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER server_stickers_level_count
AFTER INSERT ON server_stickers
FOR EACH ROW EXECUTE FUNCTION server_level_count_upload('figurinhas');

CREATE TRIGGER server_stickers_level_uncount
BEFORE DELETE ON server_stickers
FOR EACH ROW
WHEN (OLD.created_at > NOW() - INTERVAL '24 hours')
EXECUTE FUNCTION server_level_uncount_upload('figurinhas');

CREATE TRIGGER soundboard_sounds_level_count
AFTER INSERT ON soundboard_sounds
FOR EACH ROW EXECUTE FUNCTION server_level_count_upload('sons');

CREATE TRIGGER soundboard_sounds_level_uncount
BEFORE DELETE ON soundboard_sounds
FOR EACH ROW
WHEN (OLD.created_at > NOW() - INTERVAL '24 hours')
EXECUTE FUNCTION server_level_uncount_upload('sons');

-- Retroativo: o que o histórico mostra (membros reais atuais, mensagens que
-- ainda existem sem as repetições seguidas, figurinhas e sons atuais), com o
-- mesmo teto diário, no dia em que aconteceu. Tempo em call e live não tem
-- histórico: começa do zero. O membro novo dos que entrarem daqui em diante
-- (ou virarem conta real depois) vem do backend (serverlevel.Repository).
INSERT INTO server_level_members (server_id, user_id, created_at)
SELECT sm.server_id, sm.user_id, sm.joined_at
FROM server_members sm
WHERE server_level_real(sm.user_id);

WITH ordenadas AS (
    SELECT c.server_id, m.author_id, m.created_at,
           badge_message_signature(m) AS sig,
           LAG(badge_message_signature(m)) OVER w AS sig_antes,
           LAG(m.created_at) OVER w AS at_antes
    FROM messages m
    JOIN channels c ON c.id = m.channel_id
    WHERE m.system_kind IS NULL AND server_level_real(m.author_id)
    WINDOW w AS (PARTITION BY m.author_id, m.channel_id ORDER BY m.created_at, m.id)
),
contadas AS (
    SELECT server_id, author_id AS user_id, created_at FROM ordenadas
    WHERE at_antes IS NULL OR at_antes <= created_at - INTERVAL '1 hour' OR sig_antes <> sig
),
eventos AS (
    SELECT server_id, user_id, 'membros' AS source, 50 AS xp, created_at FROM server_level_members
    UNION ALL
    SELECT server_id, user_id, 'mensagens', 2, created_at FROM contadas
    UNION ALL
    SELECT server_id, uploader_id, 'figurinhas', 10, created_at FROM server_stickers
    WHERE server_level_real(uploader_id)
    UNION ALL
    SELECT server_id, uploader_id, 'sons', 10, created_at FROM soundboard_sounds
    WHERE server_level_real(uploader_id)
)
INSERT INTO server_level_daily (server_id, day, source, user_id, xp)
SELECT server_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, source, user_id,
       LEAST(SUM(xp), server_level_cap(source))
FROM eventos
GROUP BY server_id, day, source, user_id;

INSERT INTO server_levels (server_id, xp, level)
SELECT server_id, SUM(xp), NULL FROM server_level_daily GROUP BY server_id;
