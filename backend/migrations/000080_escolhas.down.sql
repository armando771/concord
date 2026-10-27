-- Volta para a tabela da 000066 (banner do #317): só o "Fez o L" tem lugar
-- nela; as outras escolhas se perdem.
CREATE TABLE IF NOT EXISTS segundo_turno_respostas (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    fez_o_l BOOLEAN NOT NULL,
    respondido_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO segundo_turno_respostas (user_id, fez_o_l, respondido_em)
SELECT user_id, opcao = 'l', respondido_em
FROM escolhas
WHERE enquete = 'segundo-turno'
ON CONFLICT (user_id) DO NOTHING;

DROP TABLE IF EXISTS escolhas;
