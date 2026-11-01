-- Banner "Você fez o L no segundo turno?" (internal/segundoturno). A resposta é
-- única: sim ou não, gravada uma vez e nunca alterada. O "sim" dá o badge "l"
-- (internal/badge, categoria exclusiva); o "não" só impede o banner de voltar
-- e não aparece para ninguém.
CREATE TABLE segundo_turno_respostas (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    fez_o_l BOOLEAN NOT NULL,
    respondido_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
