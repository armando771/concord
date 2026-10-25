DROP TRIGGER IF EXISTS message_reactions_badge_count ON message_reactions;
DROP TRIGGER IF EXISTS messages_badge_count ON messages;
DROP FUNCTION IF EXISTS badge_count_reaction();
DROP FUNCTION IF EXISTS badge_count_message();
DROP INDEX IF EXISTS idx_servers_owner;
DROP TABLE IF EXISTS user_badges;
DROP TABLE IF EXISTS user_badge_stats;
