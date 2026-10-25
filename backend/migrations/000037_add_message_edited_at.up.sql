-- Quando o autor editou o texto da mensagem; NULL = nunca editada.
ALTER TABLE messages ADD COLUMN edited_at TIMESTAMPTZ NULL;
