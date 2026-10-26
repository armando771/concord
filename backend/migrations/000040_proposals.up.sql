-- Quadro de propostas (kanban global): qualquer pessoa sugere uma melhoria,
-- todos votam sim/não por 7 dias e, se o sim vencer, a proposta vai para o time
-- tech (com uma issue no GitHub).
--   status: voting -> proposed -> in_progress -> done; ou voting -> rejected.
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'voting'
        CHECK (status IN ('voting', 'proposed', 'in_progress', 'done', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    voting_ends_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ NULL,
    github_issue_number INT NULL,
    github_issue_url TEXT NULL
);

CREATE INDEX idx_proposals_status ON proposals (status, voting_ends_at);
CREATE INDEX idx_proposals_author ON proposals (author_id);

-- Um voto por pessoa; trocar o voto atualiza a linha.
CREATE TABLE proposal_votes (
    proposal_id UUID NOT NULL REFERENCES proposals (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    approve BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (proposal_id, user_id)
);
