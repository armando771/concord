DELETE FROM user_badges WHERE category = 'votante';
DROP INDEX IF EXISTS idx_proposal_votes_user;
