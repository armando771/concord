-- O canal de sistema do Maestro passa de "bot" para "musica". Só o canal de
-- sistema é renomeado: um canal comum que o usuário chamou de "bot" fica como está.
-- UNIQUE (server_id, name): se o servidor já tem outro canal "musica" (de texto
-- ou de voz), o do Maestro vira "musica-maestro"; se esse também existir, mantém
-- o nome antigo (o backend então posta no canal onde o comando foi dado).
UPDATE channels c
SET name = CASE
    WHEN NOT EXISTS (SELECT 1 FROM channels o WHERE o.server_id = c.server_id AND o.name = 'musica')
        THEN 'musica'
    WHEN NOT EXISTS (SELECT 1 FROM channels o WHERE o.server_id = c.server_id AND o.name = 'musica-maestro')
        THEN 'musica-maestro'
    ELSE c.name
END
WHERE c.is_system AND c.type = 'text' AND c.name IN ('bot', 'bot-maestro');
