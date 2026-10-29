-- Tokens FCM dos aparelhos para o push do app mobile (ADR 0022).
-- O token é único: se outra conta entrar no mesmo aparelho, o token muda de dono.
CREATE TABLE push_tokens (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform VARCHAR(16) NOT NULL DEFAULT 'android',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_tokens_user ON push_tokens (user_id);
