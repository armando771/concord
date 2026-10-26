-- @all/@here: "all" ou "here" quando a mensagem pinga o canal (o backend só
-- grava para dono/moderador, com anti-spam); NULL = não pinga ninguém.
ALTER TABLE messages
  ADD COLUMN mention_everyone VARCHAR(8) NULL
    CHECK (mention_everyone IN ('all', 'here'));
