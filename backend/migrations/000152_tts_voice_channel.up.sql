-- /tts só toca na call de onde veio (issue #384, docs/adr/0012-tts-no-cliente.md):
-- a mensagem guarda o canal de voz cuja call ouve. NULL em DM e nas TTS
-- antigas (em canal, NULL = ninguém ouve).
ALTER TABLE messages
    ADD COLUMN tts_voice_channel_id UUID NULL REFERENCES channels (id) ON DELETE SET NULL;
