DROP TRIGGER IF EXISTS messages_badge_first ON messages;
DROP FUNCTION IF EXISTS badge_first_message();
DELETE FROM user_badges WHERE category = 'primeira';
DROP TABLE IF EXISTS server_first_messages;
