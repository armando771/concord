-- Volta o canal de sistema do Maestro para "bot" (ou "bot-maestro" se o nome já
-- estiver em uso no servidor). Só o canal de sistema é mexido.
UPDATE channels c
SET name = CASE
    WHEN NOT EXISTS (SELECT 1 FROM channels o WHERE o.server_id = c.server_id AND o.name = 'bot')
        THEN 'bot'
    WHEN NOT EXISTS (SELECT 1 FROM channels o WHERE o.server_id = c.server_id AND o.name = 'bot-maestro')
        THEN 'bot-maestro'
    ELSE c.name
END
WHERE c.is_system AND c.type = 'text' AND c.name IN ('musica', 'musica-maestro');
