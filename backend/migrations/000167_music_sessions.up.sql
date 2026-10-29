-- Sessões do Maestro (internal/music/session.go, ADR 0019): onde cada player
-- estava, para o bot voltar ao canal e continuar a música depois de o
-- servidor reiniciar (deploy). Uma por canal de voz; o backend apaga quando o
-- player fecha de verdade (call acabou, ocioso, Maestro removido) e descarta
-- no boot a que não dá para retomar. Os itens guardam só o ID do vídeo (a URL
-- de stream expira; o áudio é baixado de novo).
CREATE TABLE music_sessions (
    channel_id UUID PRIMARY KEY,
    server_id UUID NOT NULL,
    call_id UUID NOT NULL,
    text_channel_id UUID,
    now_item JSONB,
    position_ms BIGINT NOT NULL DEFAULT 0 CHECK (position_ms >= 0),
    queue JSONB NOT NULL DEFAULT '[]',
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
