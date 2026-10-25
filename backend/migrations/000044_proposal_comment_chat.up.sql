-- Comentários das propostas com os recursos do chat do servidor: responder,
-- reagir e anexar imagem, vídeo e áudio.

-- Resposta a outro comentário da mesma proposta. Se o original é apagado, a
-- resposta continua e só perde a referência.
ALTER TABLE proposal_comments
    ADD COLUMN reply_to_id UUID NULL REFERENCES proposal_comments (id) ON DELETE SET NULL;

CREATE INDEX idx_proposal_comments_reply_to ON proposal_comments (reply_to_id)
    WHERE reply_to_id IS NOT NULL;

-- Uma reação por (comentário, pessoa, emoji), como em message_reactions.
CREATE TABLE proposal_comment_reactions (
    comment_id UUID NOT NULL REFERENCES proposal_comments (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emoji VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id, emoji)
);

CREATE INDEX idx_proposal_comment_reactions_comment ON proposal_comment_reactions (comment_id);

-- Anexo de comentário. O arquivo no disco (uploads/proposals) se chama "<id>".
-- Nasce "pendente" (comment_id nulo) no upload e é ligado ao comentário quando
-- ele é criado; a limpeza apaga as pendentes antigas.
CREATE TABLE proposal_comment_attachments (
    id UUID PRIMARY KEY,
    comment_id UUID NULL REFERENCES proposal_comments (id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind VARCHAR(8) NOT NULL CHECK (kind IN ('image', 'video', 'audio')),
    content_type VARCHAR(64) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),
    width INT NULL CHECK (width > 0),
    height INT NULL CHECK (height > 0),
    duration_ms INT NULL CHECK (duration_ms > 0),
    position SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proposal_comment_attachments_comment ON proposal_comment_attachments (comment_id, position);
CREATE INDEX idx_proposal_comment_attachments_pending ON proposal_comment_attachments (created_at)
    WHERE comment_id IS NULL;
