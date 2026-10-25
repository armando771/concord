DROP TABLE IF EXISTS proposal_comment_mentions;
DROP TABLE IF EXISTS proposal_comments;
DROP TABLE IF EXISTS proposal_images;
ALTER TABLE proposals DROP COLUMN IF EXISTS edited_at;
