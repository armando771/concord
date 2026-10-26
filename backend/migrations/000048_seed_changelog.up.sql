-- Histórico retroativo: o que cada versão já publicada trouxe, montado a partir
-- dos commits de cada deploy. A 0.6.2 não tem deploy no CI e fica de fora.

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.1', '2026-10-24T22:54:07Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Chat de servidores e mensagens diretas, com chamadas de voz, câmera e compartilhamento de tela.', 0),
    ('feature', 'Entrar em um servidor com código de convite.', 1),
    ('feature', 'Atualização automática do app.', 2),
    ('feature', 'O app continua rodando em segundo plano, como o Discord.', 3),
    ('feature', 'Escolha do microfone e da saída de áudio.', 4),
    ('feature', 'Mudo e ensurdecido visíveis para todos, com indicador de quem está falando.', 5),
    ('feature', 'Compartilhar uma janela leva só o som dela (Windows).', 6),
    ('feature', 'Menu do usuário com volume, silenciar, mensagem e amizade, e cargo de moderador.', 7),
    ('feature', '@menções no chat, com notificação e som.', 8),
    ('feature', 'Efeitos sonoros na chamada.', 9),
    ('feature', 'Volume e silenciar de cada transmissão.', 10),
    ('feature', 'Supressão de ruído (RNNoise) na voz.', 11),
    ('fix', 'Reiniciar o servidor não derruba mais quem está em chamada.', 12),
    ('fix', 'O aviso de atualização aparece com o app aberto, mesmo durante uma chamada.', 13),
    ('fix', 'Notificação clicável no Windows.', 14),
    ('fix', 'Indicador de fala mais rápido.', 15),
    ('fix', 'Corrigido um travamento ao compartilhar janela no Windows.', 16)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.3', '2026-10-24T23:24:38Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('fix', 'O aviso de atualização não trava mais em 100% depois do download em segundo plano.', 0)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.4', '2026-10-24T23:31:45Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('fix', 'A supressão de ruído da voz passou a usar o RNNoise de verdade.', 0)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.5', '2026-10-24T23:42:00Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Notificações na barra de tarefas, com som.', 0),
    ('fix', 'Cancelar o compartilhamento de tela não fecha mais o app.', 1)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.6', '2026-10-24T23:50:05Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'O app agora se chama Salinha, com ícone novo.', 0),
    ('feature', 'Página de download da Salinha.', 1)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.7', '2026-10-25T00:34:31Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('fix', 'Membros offline não aparecem mais duplicados nos grupos de cargo.', 0)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.8', '2026-10-25T01:19:05Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Enquetes nas mensagens.', 0)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.9', '2026-10-25T02:15:57Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'XP e níveis por tempo em chamada.', 0),
    ('feature', 'Mosaico de transmissões que você pode reorganizar, agora com as câmeras.', 1),
    ('feature', 'Selo LIVE na lista do canal de voz, em tempo real.', 2),
    ('feature', 'Transmissões só são baixadas quando alguém assiste: elas começam pausadas, com botão Assistir.', 3),
    ('feature', 'Miniatura da transmissão ao sair da tela da chamada.', 4),
    ('feature', 'Moderadores podem mover pessoas entre canais de voz.', 5),
    ('feature', 'Overlay de jogo por cima de jogos em tela cheia em janela, ligado à chamada e às configurações.', 6),
    ('feature', 'Botão para ocultar a barra de controles da chamada.', 7),
    ('feature', 'Barra de título no mesmo preto do app.', 8),
    ('fix', 'Encerrar a chamada tira o selo LIVE na hora.', 9),
    ('fix', 'Participantes da chamada não somem mais da lista nem aparecem como "Usuário".', 10),
    ('fix', 'Ensurdecer não cala mais o som da transmissão.', 11),
    ('fix', 'Reconectar a chamada não fecha mais a transmissão que você está assistindo.', 12),
    ('fix', 'O overlay de jogo não segura o app ao sair e não aparece na captura de tela.', 13)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.10', '2026-10-25T02:34:02Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Fotos, GIFs, vídeos e áudios nas mensagens.', 0),
    ('feature', 'Anexar arquivos pelo botão, colando ou arrastando, com barra de progresso.', 1),
    ('feature', 'Gravar áudio segurando o botão do microfone.', 2),
    ('feature', 'Ícone roxo e cronômetro nos canais de voz.', 3),
    ('fix', 'Modais se ajustam à janela e o botão de fechar fica sempre acessível.', 4)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.11', '2026-10-25T02:51:08Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Respostas e reações com emotes nas mensagens.', 0),
    ('feature', 'Mosaico de transmissões reorganizado só pelos formatos.', 1),
    ('fix', 'Ao atualizar o app durante uma chamada, você volta ao canal de voz.', 2),
    ('fix', 'Nível e animação de subir de nível na lista de membros.', 3),
    ('fix', 'O ícone verde de voz só aparece nos canais com gente.', 4)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.12', '2026-10-25T03:24:55Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Cartão de perfil do membro ao clicar na pessoa.', 0),
    ('feature', 'Canal principal do servidor e menu do canal no botão direito.', 1),
    ('feature', 'Mutar e ajustar o volume de uma transmissão ao passar o mouse (só para você).', 2),
    ('feature', 'Versão para Linux (AppImage), com download na página.', 3),
    ('fix', 'Cursor de clique nas pessoas do canal de voz.', 4),
    ('fix', 'Seu nome aparece em negrito no canal de voz, sem o "(você)".', 5)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.13', '2026-10-25T04:20:42Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Salinha no navegador: link "Usar no navegador" na página de download, com compartilhamento de tela e notificações.', 0),
    ('feature', 'Aniversário no perfil, com ano e idade.', 1),
    ('feature', 'Animação de subir de nível que cresce com o nível.', 2),
    ('feature', 'O som de alguém entrando na chamada ficou bem mais alto.', 3),
    ('feature', 'O mini-player da transmissão pode ser arrastado.', 4),
    ('feature', 'Opacidade ajustável do overlay de jogo.', 5),
    ('fix', 'Sair da conta não volta mais sozinho, e uma queda de rede não desloga.', 6),
    ('fix', 'Login seguro com várias abas abertas.', 7),
    ('fix', 'As notificações nativas do Windows voltam a aparecer.', 8),
    ('fix', '"Iniciar com o Windows" não desmarca mais ao reabrir as configurações.', 9),
    ('fix', 'Ordem estável de quem está conectado no canal de voz.', 10),
    ('fix', 'Efeitos de nível no avatar sem corte.', 11)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.14', '2026-10-25T04:44:36Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Perfil estilo Discord e nova tela de configurações.', 0),
    ('feature', 'Mesa de áudio compartilhada por servidor nas chamadas de voz.', 1)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.15', '2026-10-25T12:21:02Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Amigos e mensagens diretas no estilo Discord.', 0),
    ('feature', 'Login com e-mail ou nome de usuário.', 1),
    ('feature', 'Reordenar canais arrastando na barra lateral.', 2),
    ('feature', '@all e @here no chat do canal.', 3),
    ('feature', 'Barras laterais redimensionáveis.', 4),
    ('feature', 'Overlay de jogo: Shift+Tab move e redimensiona, atalho de edição configurável e visual bem fraco em repouso, mais forte em quem fala.', 5),
    ('feature', 'Mensagens de erro do login e do cadastro em português.', 6),
    ('feature', 'Limite de tentativas de login e de cadastros por IP.', 7),
    ('fix', 'A busca e a lista de amigos não expõem mais o e-mail de outras pessoas.', 8),
    ('fix', 'Senhas com mais de 72 bytes são tratadas corretamente.', 9),
    ('fix', 'O aviso de atualização aparece logo depois do lançamento.', 10),
    ('fix', 'O anel de fala do seu próprio avatar acende na hora.', 11),
    ('fix', 'Nomes longos de canal aparecem inteiros na barra lateral.', 12),
    ('fix', 'O selo de nível sai da lista de quem está no canal de voz.', 13)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.16', '2026-10-25T14:12:29Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Cargos, permissões e canais privados, estilo Discord, com configurações do servidor.', 0),
    ('feature', '"Fulano está digitando…" embaixo do campo de mensagem.', 1),
    ('fix', 'Uma mensagem que falha ao enviar nunca perde o texto (e oferece copiar).', 2),
    ('fix', 'O campo de mensagem limpa na hora do envio.', 3),
    ('fix', 'Ordem das mensagens consistente e carregamento de mensagens antigas mais confiável.', 4),
    ('fix', 'Lista de mensagens diretas mais leve.', 5)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.17', '2026-10-25T15:32:59Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Login e cadastro estilo Discord, com confirmação de e-mail e recuperação de senha.', 0),
    ('feature', 'Tela "Algo deu errado" no lugar de erros crus.', 1),
    ('feature', 'Mudo, ensurdecido e transmissão de tela sobrevivem ao reinício do servidor.', 2),
    ('feature', 'O app recupera o que perdeu quando a conexão do chat volta.', 3),
    ('feature', 'Aviso quando o Linux roda sem AppImage (sem atualização automática).', 4),
    ('feature', 'Página de download mostra só o download do seu sistema.', 5),
    ('fix', 'Silenciar e ensurdecer feitos por moderador sobrevivem ao reinício do servidor.', 6),
    ('fix', 'A chamada de DM atendida continua ativa depois do reinício.', 7),
    ('fix', 'Uma falha passageira ao reconectar não derruba mais a chamada.', 8),
    ('fix', 'Convidar amigo não pisca mais a tela.', 9),
    ('fix', 'Mensagens perdidas contam como não lidas.', 10)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.18', '2026-10-25T15:53:49Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Atividades na chamada, começando com o Krunker.io (janela no desktop, dentro da página na web).', 0),
    ('fix', 'Encerrar uma atividade não passa mais pelo tempo de espera.', 1),
    ('fix', 'A live não congela mais com a janela em segundo plano.', 2),
    ('fix', 'Marca da Salinha e campos mais limpos no login e no cadastro.', 3)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.19', '2026-10-25T16:30:32Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Links de convite com página no navegador, prévia pública, botão "Gerar novo link" e abertura direta no app.', 0),
    ('feature', 'Apelido por servidor, com permissões para alterar e gerenciar apelidos.', 1),
    ('feature', 'Editar mensagens (no canal e na DM), copiar texto e links clicáveis.', 2),
    ('feature', 'Badges de perfil com níveis, fileira no perfil e aviso ao conquistar um novo.', 3),
    ('feature', 'Painel "Voz conectada" estilo Discord em todas as telas.', 4),
    ('feature', 'Anel verde na sua foto enquanto você fala.', 5),
    ('feature', 'Animações de marco a cada 10 níveis.', 6),
    ('feature', 'Fonte Outfit e textos no tamanho do Discord.', 7),
    ('fix', 'Menções, @all/@here e DMs avisam mesmo quando você está em outro chat.', 8),
    ('fix', 'Apelidos e nomes de exibição não aceitam mais caracteres invisíveis.', 9),
    ('fix', 'Botão direito em texto selecionado ou link abre o menu do navegador.', 10),
    ('fix', 'Ao editar, a mensagem só mantém o @all/@here que o texto ainda marca.', 11)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.20', '2026-10-25T17:19:38Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Atalhos de teclado e de mouse estilo Discord.', 0),
    ('feature', 'Botão de tela cheia nas transmissões assistidas.', 1),
    ('feature', 'Ícone do servidor por upload de imagem ou GIF, inclusive ao criar o servidor.', 2),
    ('fix', 'Um clique no servidor já abre o chat dele.', 3)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.21', '2026-10-25T17:55:56Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Linux: atualização automática sem FUSE e instalação por um comando.', 0),
    ('feature', 'Página de download com comando de instalação copiável.', 1),
    ('fix', 'Instalador protegido contra download cortado.', 2),
    ('fix', 'No Linux, falhas de atualização ficam registradas e o app volta sozinho à versão anterior.', 3)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.22', '2026-10-25T18:23:33Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Atividade: o jogo em andamento aparece na lista de membros, amigos, DMs, rodapé, canal de voz e perfil, com opção de ocultar.', 0),
    ('feature', 'Salas de voz trancadas, com pedido de permissão para entrar.', 1)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.23', '2026-10-25T19:01:09Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Quadro de propostas de melhoria com votação.', 0),
    ('feature', 'Barra de atualização do app, com som de aviso.', 1),
    ('feature', 'Buff de XP de voz conforme o número de pessoas na chamada, com banner animado por rank.', 2),
    ('fix', 'O buff de XP zera ao sair da chamada e o banner não toca para quem está mutado.', 3)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.24', '2026-10-25T19:21:15Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Janela de conexão e desempenho da chamada.', 0)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.25', '2026-10-25T20:08:40Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Propostas: imagens, comentários com menção e edição.', 0),
    ('feature', 'Silenciar servidor e canal, como no Discord.', 1),
    ('feature', 'Escolher a resolução e o FPS da transmissão.', 2),
    ('fix', 'Seu próprio avatar aparece na chamada.', 3)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.26', '2026-10-25T20:45:15Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Mudar a qualidade da transmissão sem interrompê-la.', 0),
    ('fix', 'O detalhe da proposta abre opaco e em duas colunas.', 1)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.27', '2026-10-25T22:10:49Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Propostas: comentários com responder, reagir, copiar e anexos, como no chat do servidor.', 0),
    ('feature', 'Arrastar cards entre colunas, o que encerra a votação.', 1)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.28', '2026-10-25T22:48:36Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Opções de qualidade da transmissão ao passar o mouse no botão de parar.', 0),
    ('feature', 'Ícone do jogo na atividade, no lugar do controle genérico.', 1),
    ('feature', 'Ícone de chamada de voz nos servidores da lista lateral.', 2),
    ('feature', 'Ver quem reagiu ao passar o mouse na reação.', 3),
    ('fix', 'O card arrastado nas propostas fica centralizado no cursor.', 4)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.29', '2026-10-25T23:23:31Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Maestro, o bot de música: toca músicas do YouTube nas chamadas por comandos no chat, com busca, sugestões, fila e votação para pular.', 0),
    ('feature', 'Painel "Tocando agora" e vídeo da música sincronizado.', 1),
    ('feature', 'O volume da música abaixa quando alguém fala.', 2),
    ('feature', 'Detecta jogos da Steam fora do catálogo.', 3),
    ('fix', 'O selo de voz da barra de servidores ficou maior e sem corte.', 4)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.30', '2026-10-25T23:46:01Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Ícone dos jogos da Steam e selo do jogo em quem está no canal de voz.', 0)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.31', '2026-10-26T00:32:21Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('feature', 'Fixar mensagens nos canais de texto do servidor.', 0),
    ('feature', 'Desenhar e anotar sobre a transmissão de tela (caneta).', 1),
    ('feature', 'Ver a foto de quem está assistindo à transmissão.', 2),
    ('feature', 'Volume de entrada e de saída, detecção de voz e sensibilidade.', 3),
    ('feature', 'O Maestro aparece no canal de voz e clicar nele abre o painel.', 4),
    ('fix', 'Não aparece mais pop-up quando alguém sai da chamada de um canal.', 5),
    ('fix', 'O Maestro volta a ter som.', 6),
    ('fix', 'Seletores de dispositivo no padrão visual do app.', 7)
  ) AS v(kind, text, position);

WITH rel AS (
  INSERT INTO changelog_releases (version, released_at)
  VALUES ('0.6.32', '2026-10-26T00:44:25Z')
  ON CONFLICT (version) DO NOTHING
  RETURNING id
)
INSERT INTO changelog_entries (release_id, kind, text, position)
SELECT rel.id, v.kind, v.text, v.position FROM rel,
  (VALUES
    ('fix', 'Corrigido um travamento ao entrar numa sala com tela compartilhada.', 0)
  ) AS v(kind, text, position);
