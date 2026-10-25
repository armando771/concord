-- Canal principal do servidor: onde vão os avisos do próprio servidor
-- (ex.: aniversários). Vazio = o primeiro canal de texto (calculado na
-- consulta), então servidores antigos e canal apagado já têm um principal.
ALTER TABLE servers
  ADD COLUMN primary_channel_id UUID REFERENCES channels (id) ON DELETE SET NULL;
