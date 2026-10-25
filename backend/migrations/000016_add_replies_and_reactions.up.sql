ALTER TABLE messages
  ADD COLUMN reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX idx_messages_reply_to_id
  ON messages(reply_to_id)
  WHERE reply_to_id IS NOT NULL;

CREATE TABLE message_reactions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message_id
  ON message_reactions(message_id);
