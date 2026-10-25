-- Propostas v2: imagens anexadas, comentários com menção e marca de edição.
ALTER TABLE proposals ADD COLUMN edited_at TIMESTAMPTZ NULL;

-- Imagem de uma proposta. O arquivo no disco se chama "<id>". Enquanto
-- proposal_id é nulo ela está "pendente" (enviada, ainda não salva no card) e a
-- limpeza apaga as pendentes antigas.
CREATE TABLE proposal_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NULL REFERENCES proposals (id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content_type VARCHAR(32) NOT NULL,
    size BIGINT NOT NULL,
    position SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proposal_images_proposal ON proposal_images (proposal_id, position);
CREATE INDEX idx_proposal_images_pending ON proposal_images (created_at) WHERE proposal_id IS NULL;

CREATE TABLE proposal_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES proposals (id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_proposal_comments_proposal ON proposal_comments (proposal_id, created_at);
CREATE INDEX idx_proposal_comments_author ON proposal_comments (author_id, created_at);

-- Quem foi marcado num comentário; seen_at nulo = ainda não viu.
CREATE TABLE proposal_comment_mentions (
    comment_id UUID NOT NULL REFERENCES proposal_comments (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    seen_at TIMESTAMPTZ NULL,
    PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX idx_proposal_mentions_unseen ON proposal_comment_mentions (user_id) WHERE seen_at IS NULL;
