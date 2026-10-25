DROP TABLE IF EXISTS poll_votes;
DROP TABLE IF EXISTS poll_answers;
DROP TABLE IF EXISTS polls;

DELETE FROM messages WHERE content = '';
ALTER TABLE messages DROP CONSTRAINT messages_content_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_check CHECK (char_length(content) BETWEEN 1 AND 4000);
