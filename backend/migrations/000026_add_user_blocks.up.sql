-- Bloqueio como no Discord: unilateral (quem bloqueia escolhe), some das
-- listas, impede pedido de amizade e mensagem direta.
CREATE TABLE user_blocks (
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_user_blocks_blocked ON user_blocks (blocked_id);

-- Pedidos cruzados (A→B e B→A ao mesmo tempo) viravam duas linhas. Fica uma
-- só por par: a aceita ou, se as duas pendentes, a mais antiga.
DELETE FROM friendships f
USING friendships g
WHERE f.requester_id = g.addressee_id
  AND f.addressee_id = g.requester_id
  AND (
    (g.status = 'accepted' AND f.status <> 'accepted')
    OR (f.status = g.status AND (f.created_at, f.requester_id) > (g.created_at, g.requester_id))
  );

CREATE UNIQUE INDEX friendships_pair_key ON friendships (
    LEAST(requester_id, addressee_id),
    GREATEST(requester_id, addressee_id)
);
