-- Badge Caçador de bugs: o time concede à mão, somando os bugs que cada um
-- reportou (SQL em docs/HOSPEDAGEM.md). Começa vazia; sem linha (ou com 0)
-- o badge nem aparece.
CREATE TABLE bug_hunters (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    bugs INT NOT NULL DEFAULT 0 CHECK (bugs >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
