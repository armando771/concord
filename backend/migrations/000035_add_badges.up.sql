-- Badges do perfil. Os números que não existiam em outro lugar ficam em
-- user_badge_stats; o resto vem de users, user_levels e servers.
--   - mensagens e reações: contadores mantidos por trigger (nada de COUNT
--     a cada perfil aberto). Mensagem apagada não desconta; reação removida
--     desconta (senão tirar e pôr a mesma reação subiria o badge).
--   - tempo transmitindo, call de madrugada/manhã, maior call e maior call
--     seguida: gravados pelo tracker do backend (internal/badge).
CREATE TABLE user_badge_stats (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    messages_sent BIGINT NOT NULL DEFAULT 0 CHECK (messages_sent >= 0),
    reactions_given BIGINT NOT NULL DEFAULT 0 CHECK (reactions_given >= 0),
    stream_seconds BIGINT NOT NULL DEFAULT 0 CHECK (stream_seconds >= 0),
    night_seconds BIGINT NOT NULL DEFAULT 0 CHECK (night_seconds >= 0),
    morning_seconds BIGINT NOT NULL DEFAULT 0 CHECK (morning_seconds >= 0),
    peak_call_size INT NOT NULL DEFAULT 0 CHECK (peak_call_size >= 0),
    longest_session_seconds BIGINT NOT NULL DEFAULT 0 CHECK (longest_session_seconds >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quando cada tier foi alcançado pela primeira vez. Um tier gravado nunca
-- se perde, mesmo que o número caia depois.
CREATE TABLE user_badges (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL,
    tier SMALLINT NOT NULL CHECK (tier >= 1),
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, category, tier)
);

-- "Dono de servidor" conta os servidores de cada um.
CREATE INDEX IF NOT EXISTS idx_servers_owner ON servers (owner_id);

-- Contagem inicial do que já existe (mensagens de sistema não contam).
INSERT INTO user_badge_stats (user_id, messages_sent)
SELECT author_id, COUNT(*) FROM messages WHERE system_kind IS NULL GROUP BY author_id;

INSERT INTO user_badge_stats (user_id, reactions_given)
SELECT user_id, COUNT(*) FROM message_reactions GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE SET reactions_given = EXCLUDED.reactions_given;

CREATE FUNCTION badge_count_message() RETURNS trigger AS $$
BEGIN
    IF NEW.system_kind IS NULL THEN
        INSERT INTO user_badge_stats (user_id, messages_sent) VALUES (NEW.author_id, 1)
        ON CONFLICT (user_id) DO UPDATE SET
            messages_sent = user_badge_stats.messages_sent + 1,
            updated_at = NOW();
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_badge_count
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION badge_count_message();

CREATE FUNCTION badge_count_reaction() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO user_badge_stats (user_id, reactions_given) VALUES (NEW.user_id, 1)
        ON CONFLICT (user_id) DO UPDATE SET
            reactions_given = user_badge_stats.reactions_given + 1,
            updated_at = NOW();
    ELSE
        UPDATE user_badge_stats
        SET reactions_given = GREATEST(reactions_given - 1, 0), updated_at = NOW()
        WHERE user_id = OLD.user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_reactions_badge_count
AFTER INSERT OR DELETE ON message_reactions
FOR EACH ROW EXECUTE FUNCTION badge_count_reaction();
