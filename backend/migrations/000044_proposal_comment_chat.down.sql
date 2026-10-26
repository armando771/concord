DROP TABLE IF EXISTS proposal_comment_attachments;
DROP TABLE IF EXISTS proposal_comment_reactions;
DROP INDEX IF EXISTS idx_proposal_comments_reply_to;
ALTER TABLE proposal_comments DROP COLUMN IF EXISTS reply_to_id;
