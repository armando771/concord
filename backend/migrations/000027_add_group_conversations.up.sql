-- DMs em grupo e estado por participante (fechar DM, não lidas).
-- DM 1:1 continua com user_a_id < user_b_id (e o UNIQUE do par); grupo não
-- usa essas colunas: os participantes ficam em conversation_members.
ALTER TABLE conversations
  ADD COLUMN type VARCHAR(10) NOT NULL DEFAULT 'dm' CHECK (type IN ('dm', 'group')),
  ADD COLUMN name VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN icon_url TEXT NULL,
  ADD COLUMN owner_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  ALTER COLUMN user_a_id DROP NOT NULL,
  ALTER COLUMN user_b_id DROP NOT NULL;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_shape_check CHECK (
  (type = 'dm' AND user_a_id IS NOT NULL AND user_b_id IS NOT NULL AND user_a_id < user_b_id)
  OR (type = 'group' AND user_a_id IS NULL AND user_b_id IS NULL)
);

-- hidden: a pessoa fechou a DM (volta ao chegar mensagem nova).
-- last_read_at: até onde a pessoa leu; as não lidas são as mensagens dos
-- outros depois disso.
CREATE TABLE conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conversation_members_user ON conversation_members (user_id);

-- DMs que já existem: os dois participantes, tudo lido.
INSERT INTO conversation_members (conversation_id, user_id, joined_at)
SELECT id, user_a_id, created_at FROM conversations
UNION ALL
SELECT id, user_b_id, created_at FROM conversations;
