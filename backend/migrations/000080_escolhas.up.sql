-- Enquetes de escolha única (internal/enquete). A resposta é definitiva: uma
-- por pessoa por enquete. A opção pode conceder um badge exclusivo (ex.: "l" e
-- "22" do segundo turno, categorias l e v22 de internal/badge); as outras só
-- impedem a pergunta de voltar e não aparecem para ninguém.
CREATE TABLE IF NOT EXISTS escolhas (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    enquete TEXT NOT NULL,
    opcao TEXT NOT NULL,
    respondido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, enquete)
);

-- A 000066 (banner do #317) já rodou em produção. Quem respondeu "sim" lá
-- continua com o badge l: vira a escolha "l" da enquete do segundo turno. Quem
-- respondeu "não" não é levado: o "não" de antes não dizia se foi 22 ou
-- nenhum, então essa pessoa escolhe de novo na enquete.
INSERT INTO escolhas (user_id, enquete, opcao, respondido_em)
SELECT user_id, 'segundo-turno', 'l', respondido_em
FROM segundo_turno_respostas
WHERE fez_o_l
ON CONFLICT (user_id, enquete) DO NOTHING;

DROP TABLE IF EXISTS segundo_turno_respostas;
