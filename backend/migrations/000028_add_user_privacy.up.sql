-- Privacidade (Configurações → Privacidade e segurança): quem pode mandar
-- pedido de amizade e se membros de servidores em comum podem mandar DM.
ALTER TABLE users
  ADD COLUMN friend_request_policy VARCHAR(16) NOT NULL DEFAULT 'everyone'
    CHECK (friend_request_policy IN ('everyone', 'mutual_friends', 'mutual_servers', 'nobody')),
  ADD COLUMN allow_server_dms BOOLEAN NOT NULL DEFAULT TRUE;
