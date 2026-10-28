-- Convite de visitante para uma call (docs/adr/0017-visitante-na-call.md).

-- Visitante sem conta: usuário efêmero, sem senha que funcione, fora da busca
-- e dos pedidos de amizade. Apagado depois que o acesso acaba.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

-- O link: só o hash do token fica no banco. Vale até expires_at (o mesmo
-- prazo do acesso de quem entrou) ou até ser revogado.
CREATE TABLE IF NOT EXISTS call_guest_invites (
    id UUID PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    server_id UUID NOT NULL REFERENCES servers (id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Bits de permissão extras do visitante (SPEAK e STREAM); ouvir e
    -- assistir valem sempre.
    permissions BIGINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_guest_invites_server ON call_guest_invites (server_id);

-- O acesso de cada pessoa que entrou pelo link. channel_id é o canal de voz
-- permitido agora (mover para outro canal troca aqui).
CREATE TABLE IF NOT EXISTS call_guest_passes (
    id UUID PRIMARY KEY,
    invite_id UUID NOT NULL REFERENCES call_guest_invites (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
    ended_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (invite_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_call_guest_passes_user ON call_guest_passes (user_id);
