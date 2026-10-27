DROP TRIGGER IF EXISTS messages_badge_stickers ON messages;
DROP FUNCTION IF EXISTS badge_count_sticker();
DELETE FROM user_badges WHERE category = 'figurinha';
ALTER TABLE user_badge_stats DROP COLUMN IF EXISTS stickers_sent;
