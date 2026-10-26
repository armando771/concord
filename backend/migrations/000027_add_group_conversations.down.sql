DROP TABLE IF EXISTS conversation_members;
DELETE FROM conversations WHERE type = 'group';
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_shape_check;
ALTER TABLE conversations
  DROP COLUMN IF EXISTS owner_id,
  DROP COLUMN IF EXISTS icon_url,
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS type,
  ALTER COLUMN user_a_id SET NOT NULL,
  ALTER COLUMN user_b_id SET NOT NULL;
ALTER TABLE conversations ADD CONSTRAINT conversations_check CHECK (user_a_id < user_b_id);
