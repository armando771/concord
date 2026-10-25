-- Aniversário (opcional; dia, mês e ano — a idade só aparece para a própria
-- pessoa) e se ela quer que os servidores anunciem.
ALTER TABLE users
  ADD COLUMN birthday_day SMALLINT NULL CHECK (birthday_day BETWEEN 1 AND 31),
  ADD COLUMN birthday_month SMALLINT NULL CHECK (birthday_month BETWEEN 1 AND 12),
  ADD COLUMN birthday_year SMALLINT NULL CHECK (birthday_year BETWEEN 1900 AND 2100),
  ADD COLUMN announce_birthday BOOLEAN NOT NULL DEFAULT TRUE,
  ADD CONSTRAINT users_birthday_complete CHECK (
    (birthday_day IS NULL) = (birthday_month IS NULL)
    AND (birthday_day IS NULL) = (birthday_year IS NULL)
  );

CREATE INDEX idx_users_birthday ON users (birthday_month, birthday_day) WHERE announce_birthday;

-- Mensagem enviada pelo próprio servidor (ex.: "birthday"); NULL = mensagem comum.
ALTER TABLE messages ADD COLUMN system_kind VARCHAR(32) NULL;

-- Um anúncio de aniversário por servidor por dia (evita mensagem repetida
-- mesmo com o backend reiniciando).
CREATE TABLE birthday_announcements (
  server_id UUID NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
  day DATE NOT NULL,
  channel_id UUID NULL REFERENCES channels (id) ON DELETE SET NULL,
  message_id UUID NULL REFERENCES messages (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (server_id, day)
);
