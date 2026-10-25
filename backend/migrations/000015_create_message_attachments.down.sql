-- Mensagens que só tinham anexo ficariam como balões vazios: apaga junto.
-- Os arquivos continuam em UPLOADS_DIR (apague a pasta à mão se quiser).
DELETE FROM messages m
WHERE m.content = ''
AND EXISTS (SELECT 1 FROM message_attachments a WHERE a.message_id = m.id)
AND NOT EXISTS (SELECT 1 FROM polls p WHERE p.message_id = m.id);

DROP TABLE IF EXISTS message_attachments;
