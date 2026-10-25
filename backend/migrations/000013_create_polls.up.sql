-- Enquete anexada a uma mensagem (como no Discord): a mensagem da enquete
-- não tem texto, então o conteúdo pode ficar vazio.
ALTER TABLE messages DROP CONSTRAINT messages_content_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_check CHECK (char_length(content) <= 4000);

CREATE TABLE polls (
    message_id UUID PRIMARY KEY REFERENCES messages (id) ON DELETE CASCADE,
    question VARCHAR(300) NOT NULL CHECK (char_length(question) >= 1),
    allow_multiselect BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NULL
);

CREATE TABLE poll_answers (
    message_id UUID NOT NULL REFERENCES polls (message_id) ON DELETE CASCADE,
    answer_id SMALLINT NOT NULL CHECK (answer_id BETWEEN 1 AND 10),
    text VARCHAR(55) NOT NULL CHECK (char_length(text) >= 1),
    emoji VARCHAR(32) NULL,
    image_url VARCHAR(512) NULL,
    PRIMARY KEY (message_id, answer_id),
    CHECK (emoji IS NULL OR image_url IS NULL)
);

CREATE TABLE poll_votes (
    message_id UUID NOT NULL,
    answer_id SMALLINT NOT NULL,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, answer_id, user_id),
    FOREIGN KEY (message_id, answer_id) REFERENCES poll_answers (message_id, answer_id) ON DELETE CASCADE
);

CREATE INDEX idx_poll_votes_user ON poll_votes (message_id, user_id);
