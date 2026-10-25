-- Quando o autor editou o texto da mensagem; NULL = nunca editada.
-- (Era 000032; virou 000037 porque o Migrate só guarda a última versão e
-- tudo abaixo da maior já aplicada é pulado para sempre.)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL;
