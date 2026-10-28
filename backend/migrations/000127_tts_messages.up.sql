-- Mensagens /tts (docs/adr/0012-tts-no-cliente.md): a mensagem é lida em voz
-- pelo app de quem está em call. Mensagens antigas não são TTS.
ALTER TABLE messages ADD COLUMN tts BOOLEAN NOT NULL DEFAULT FALSE;

-- Permissão nova (backend/internal/permission/perms.go): SEND_TTS_MESSAGES
-- (1<<30 = 1073741824) ligada para todo mundo nos servidores que já existem,
-- como nos novos, e no Moderador criado com o servidor.
UPDATE roles SET permissions = permissions | 1073741824 WHERE is_default;
UPDATE roles SET permissions = permissions | 1073741824 WHERE name = 'Moderador' AND NOT is_default;
