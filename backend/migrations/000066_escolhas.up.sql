-- Enquetes de escolha única (internal/enquete). A resposta é definitiva: uma
-- por pessoa por enquete. A opção pode conceder um badge exclusivo (ex.: "l" e
-- "22" do segundo turno, categorias l e v22 de internal/badge); as outras só
-- impedem a pergunta de voltar e não aparecem para ninguém.
CREATE TABLE escolhas (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    enquete TEXT NOT NULL,
    opcao TEXT NOT NULL,
    respondido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, enquete)
);
