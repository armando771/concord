# Hospedar a Salinha para os amigos

Este PC é o servidor (backend + Postgres + LiveKit). O **playit.gg** leva o
tráfego da internet até ele sem abrir porta no roteador. Os amigos só baixam e
abrem o `.exe`.

```text
Amigo (.exe) ──► playit ──► este PC
                 ├─ TCP  → backend (API, chat, sinalização /rtc)
                 ├─ UDP  → LiveKit (voz/vídeo/tela)
                 └─ TCP  → LiveKit (fallback de mídia p/ redes que bloqueiam UDP)
```

## 1. Preparar o PC

- **Cabo de rede** (não Wi-Fi) e **sem suspender**: configure o sistema para
  não dormir, nem com a tampa fechada.
- Docker, Go e Node instalados.

## 2. Configurar o servidor

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env`:

- `JWT_SECRET` e `LIVEKIT_API_SECRET`: gere com `openssl rand -hex 32`.
- `PORT`: porta do backend. Se a 8080 já estiver em uso, troque (ex.: `8090`).
- `POSTGRES_PORT` e a porta no `DATABASE_URL`: troque se a 5432 estiver em uso.
- As portas do LiveKit e o `LIVEKIT_NODE_IP` saem do passo 3.

## 3. Criar os túneis no playit

1. Baixe o agente do playit (`playit` e `playit-cli`, em
   [playit.gg/download](https://playit.gg/download) ou nas releases do
   [playit-agent](https://github.com/playit-cloud/playit-agent/releases)) e
   coloque no `PATH`. Depois instale os serviços (seção 4) e vincule o agente
   à sua conta. O comando abaixo mostra um link para abrir no navegador:
   ```bash
   scripts/install-services.sh
   playit-cli --socket-path ~/.local/share/playit/playitd.sock setup
   ```
2. No painel do playit.gg, crie **3 túneis**, todos apontando para `127.0.0.1`:

   | Túnel | Tipo | Porta local |
   |---|---|---|
   | Salinha API | TCP | o `PORT` do `.env` (padrão 8080) |
   | Salinha mídia | **UDP** | **igual à porta pública** que o playit der |
   | Salinha mídia TCP | TCP | **igual à porta pública** que o playit der |

   Os dois túneis de mídia precisam ter **porta local = porta pública**, porque
   o LiveKit informa a própria porta aos clientes. Exemplo: se o túnel UDP
   ganhou `abc.gl.at.ply.gg:41234`, a porta local dele também é `41234`.
3. Ponha essas portas no `.env`:
   ```env
   LIVEKIT_UDP_PORT=41234   # porta do túnel UDP
   LIVEKIT_TCP_PORT=41890   # porta do túnel "mídia TCP"
   ```
4. Descubra o IP público do túnel UDP e ponha em `LIVEKIT_NODE_IP`:
   ```bash
   scripts/playit-ip.sh abc.gl.at.ply.gg
   ```
   Rode também para o túnel "mídia TCP". Se der o **mesmo IP**, o fallback TCP
   funciona; se der outro, só o UDP funciona (normalmente basta).

> Túneis TCP/UDP genéricos exigem o **playit premium** (~US$ 3/mês). A
> alternativa é uma VPS (seção 7). O túnel "mídia TCP" é opcional: só ajuda
> quem está em rede que bloqueia UDP.

## 4. Subir o servidor

```bash
scripts/server-up.sh
```

Sobe Postgres + LiveKit no Docker e roda o backend. Para conferir:
`curl http://127.0.0.1:$PORT/rtc/validate` deve responder `401` (é o LiveKit
recusando a requisição sem token, sinal de que o proxy funciona).

### Rodar sempre (serviços do usuário)

Para o servidor e o playit subirem sozinhos, instale os serviços systemd do
usuário. São três: `concord-server` (backend), `concord-playit` (agente do
playit) e `concord-playit-watchdog` (vigia do túnel):

```bash
scripts/install-services.sh
systemctl --user status concord-server       # ver se está rodando
journalctl --user -u concord-server -f       # logs
journalctl --user -u concord-playit-watchdog # o que o vigia fez
```

O agente do playit às vezes perde a sessão e para de repassar conexões sem
avisar. O vigia testa o endereço público (`PUBLIC_URL` no `.env`) a cada
minuto e reinicia o playit depois de 2 falhas seguidas.

O `concord-server` roda o binário `backend/concord-server`. Depois de
atualizar o código: `cd backend && go build -o concord-server ./cmd &&
systemctl --user restart concord-server`. O Postgres e o LiveKit sobem
sozinhos pelo Docker (`restart: unless-stopped`).

## 5. Publicar o app para os amigos (com atualização automática)

Defina `PUBLIC_URL` no `backend/.env` com o endereço público do túnel
**Salinha API** (ex.: `http://abc-api.gl.at.ply.gg:12345`) e rode:

```bash
scripts/release-win.sh          # ou: scripts/release-win.sh 0.3.0
scripts/release-linux.sh        # usa a mesma versão do package.json, sem incrementá-la
```

O script faz quatro coisas:

1. Na primeira vez, gera a **chave de assinatura** em `backend/.release-key`.
   Faça backup dela e não compartilhe: sem ela, os apps já instalados recusam
   as atualizações.
2. Sobe a versão em `frontend/package.json`.
3. Gera e assina o instalador com o endereço e a chave pública embutidos.
4. Publica tudo em `backend/updates/`, que o backend serve em `/updates/`.

**Primeira vez de cada amigo:** mande `frontend/dist/Salinha-<versão>-setup.exe`.
Como o app não é assinado, o Windows mostra "O Windows protegeu o
computador". Basta clicar em **Mais informações → Executar assim mesmo**.

**Linux x64:** mande `frontend/dist/Salinha-<versão>-x64.AppImage` ou o link da
landing page. Nas propriedades do arquivo, permita executar como programa
(ou use `chmod +x Salinha-<versão>-x64.AppImage`) e abra-o como usuário normal.
Algumas distribuições exigem instalar o FUSE 2. Não use `sudo` nem desative o
sandbox. Guarde o AppImage numa pasta sua com permissão de escrita: o
atualizador substitui o arquivo nessa pasta. Executar uma cópia extraída em
vez do AppImage não oferece atualização automática.

O release Linux usa a mesma chave Ed25519 do Windows e publica o AppImage,
seu `.sig` e `latest-linux.yml`. O Windows continua usando `latest.yml`.
Para manter versões iguais, execute o release Windows e depois o Linux,
ou passe explicitamente a mesma versão aos dois scripts. Ambos precisam
terminar com sucesso antes de executar o deploy. No CI isso é obrigatório.

**Depois disso, não precisa mandar mais nada.** Para cada versão nova, rode
`scripts/release-win.sh` e depois `scripts/release-linux.sh` de novo:

- O app checa atualizações ao abrir e a cada 5 minutos.
- Ele baixa a versão nova em segundo plano, mas só fora de chamada, porque o
  upload do servidor é o mesmo das chamadas.
- Instaladores sem assinatura válida são recusados.
- Se já estava baixada, a atualização instala ao abrir o app. Com o app aberto,
  aparece **"Nova atualização disponível"** no canto inferior direito, com o
  botão **Atualizar**.

> `scripts/build-win.sh <endereço>` ainda gera um `.exe` avulso (portable +
> instalador), mas sem atualização automática.
> Para um AppImage avulso: `scripts/build-linux.sh <endereço>`.

### No app (Linux)

- Chat, voz e vídeo precisam ser validados na distribuição de destino.
- Compartilhamento de tela é **sem áudio**; o helper de áudio é exclusivo do Windows.
- No Wayland, a captura depende do portal de compartilhamento do ambiente gráfico.
- Não há promessa de fechar para a bandeja nem de iniciar com o sistema no Linux.
- Para validar um release: abrir o AppImage, entrar na conta, enviar mensagem,
  testar microfone/câmera e compartilhar tela. Depois publicar uma segunda
  versão e conferir download, assinatura e substituição do AppImage, inclusive
  adiamento do download durante chamadas. Conferir também uma sessão X11 e Wayland.

### No app (Windows)

- **Fechar a janela** deixa o app na bandeja, como o Discord. Para fechar de
  vez, use **Sair** no ícone da bandeja.
- **Iniciar com o Windows** vem ligado e pode ser desligado nas configurações.
- **Configurações → Voz:** escolha do microfone e da saída de som.
- **Som da tela compartilhada:**
  - Ao compartilhar uma **janela**, vai só o som do app dela (Windows 10 2004
    ou mais novo).
  - Ao compartilhar a **tela inteira**, vai o som do PC todo, menos o da Salinha.

## 6. Testar

- Você (no desktop) e um amigo de **outra rede**: criar conta, virar amigos,
  entrar num canal de voz.
- Duas pessoas compartilhando tela ao mesmo tempo, com som de jogo/vídeo.
- Se a chamada abre mas fica sem áudio/vídeo, quase sempre é porta local ≠
  porta pública no túnel de mídia, ou `LIVEKIT_NODE_IP` errado. Veja
  `docker logs concord-livekit`.
- Quem está na **mesma rede** que o servidor (o seu desktop) conecta a mídia
  direto pela rede local, sem passar pelo playit.

## 7. Rodar numa VPS (recomendado)

Numa VPS com IP público não precisa de playit, e dá para ter HTTPS de graça.

1. **VPS:** Debian 13 ou Ubuntu 24.04, 2 vCPU, 2–4 GB de RAM, tráfego alto
   (~2–3 TB/mês com telas) e portas UDP liberadas. Datacenter perto do grupo.
2. **Instale** Docker (repositório oficial), `caddy` e `rsync`.
3. **`/opt/concord/.env`** (a partir do `backend/.env.example`):
   - `HOST=127.0.0.1`, para o backend escutar só local, atrás do Caddy;
     com isso o backend confia no `X-Forwarded-For` só quando a conexão vem
     do loopback (o Caddy), e o limite de tentativas de login usa o IP real.
     `TRUSTED_PROXIES` troca essa escolha (veja o `.env.example`);
   - `LIVEKIT_NODE_IP` com o IP público da VPS;
   - `LIVEKIT_UDP_PORT=7882` e `LIVEKIT_TCP_PORT=7881` (sem túnel, as portas
     são as mesmas);
   - `PUBLIC_URL=https://<seu-endereço>`;
   - os segredos (`JWT_SECRET` e as chaves do LiveKit). Usando os mesmos de
     antes, ninguém perde o login;
   - `UPLOADS_DIR` (opcional; padrão `uploads`, que vira `/opt/concord/uploads`
     porque o serviço roda com `WorkingDirectory=/opt/concord`): fotos, vídeos
     e áudios do chat;
   - `UPLOADS_MIN_FREE_GB` (opcional; padrão 5): abaixo desse espaço livre no
     disco o servidor recusa uploads novos.
4. **Endereço com HTTPS sem comprar domínio:** use `<ip-com-hífens>.sslip.io`
   (ex.: `1-2-3-4.sslip.io` aponta para `1.2.3.4`). `/etc/caddy/Caddyfile`:
   ```
   1-2-3-4.sslip.io {
   	reverse_proxy 127.0.0.1:8090
   }
   ```
   O Caddy tira o certificado sozinho. O arquivo precisa ser legível pelo
   usuário `caddy` (`chmod 644`).
5. **Serviço do backend:** `/etc/systemd/system/concord-server.service`, com
   `WorkingDirectory=/opt/concord`, `ExecStart=/opt/concord/concord-server` e
   `Restart=always`. Depois `systemctl enable --now concord-server`.
6. **Do seu PC:** `scripts/deploy-vps.sh root@IP` envia o backend, as
   migrations, o compose, a página de download (`site/`), o app web
   (`frontend/dist-web`, se existir) e as atualizações do app, e reinicia. Reiniciar não
   derruba quem está em chamada.
7. **Publicar versão do app:** `scripts/release-win.sh`, `scripts/release-linux.sh` e depois
   `scripts/deploy-vps.sh root@IP`.

**Página de download:** `site/` é uma página estática que lê
`/updates/latest.yml` (Windows) e `/updates/latest-linux.yml` (Linux) e aponta
cada botão para o artefato correspondente. A falha de um manifesto não bloqueia
o download da outra plataforma. O deploy mantém os três instaladores Windows
e três AppImages mais recentes. No
Caddyfile, um domínio próprio serve a página e repassa `/updates/` ao backend:
```
salinha.exemplo.com {
	encode zstd gzip
	handle /updates/* {
		reverse_proxy 127.0.0.1:8090
	}
	handle {
		root * /opt/concord/site
		file_server
	}
}
```
Para um endereço antigo continuar funcionando, um bloco
`antigo.exemplo.com { redir https://salinha.exemplo.com{uri} permanent }`
basta. O domínio precisa de um registro DNS `A` apontando para o IP da VPS (no
Cloudflare, com o proxy desligado — nuvem cinza — por causa do tamanho do
instalador).

**App no navegador:** a mesma Salinha, sem instalar, em
`https://app-salinha.bhrx.com.br`. Usa as mesmas contas e o mesmo backend; o
navegador fala com o backend na mesma origem (API em `/api`, chat em `/ws`,
chamadas em `/rtc`, tudo por HTTPS/WSS). O `yarn build:web` (em `frontend/`)
gera `frontend/dist-web/` e o `scripts/deploy-vps.sh` envia para
`/opt/concord/web/` (o `--delete` só mexe nessa pasta; uploads e atualizações
ficam como estão).

> **Antes de mesclar a `develop` na `main`:** o DNS, o bloco do Caddy (passos 1
> e 2) e a variável `WEB_URL` do GitHub Actions (seção "Deploy automático")
> precisam estar prontos. O merge publica sozinho a página de download, que tem
> o botão "Usar no navegador" apontando para `https://app-salinha.bhrx.com.br`;
> sem o domínio no ar, o botão leva a um erro. Confira com
> `curl -sI https://app-salinha.bhrx.com.br/` antes do merge.

1. **DNS:** no Cloudflare, registro `A` `app-salinha` → IP da VPS, com o
   proxy **desligado** (nuvem cinza). Com o proxy ligado o Caddy não consegue
   tirar o certificado sozinho e os uploads grandes do chat esbarram no limite
   do Cloudflare. Confira com `dig +short app-salinha.bhrx.com.br`.
2. **Caddy:** acrescente o bloco abaixo ao `/etc/caddy/Caddyfile` e rode
   `systemctl reload caddy`:
   ```
   app-salinha.bhrx.com.br {
   	encode zstd gzip
   	header {
   		Strict-Transport-Security "max-age=31536000"
   		X-Content-Type-Options nosniff
   		X-Frame-Options DENY
   		Referrer-Policy strict-origin-when-cross-origin
   	}

   	# Backend: API (inclui os arquivos do chat em /api/media), WebSocket do
   	# chat e sinalização do LiveKit. O reverse_proxy repassa o upgrade de WS.
   	@backend path /api /api/* /ws /rtc /rtc/*
   	handle @backend {
   		reverse_proxy 127.0.0.1:8090
   	}

   	# Arquivos com hash no nome: cache longo. Arquivo que não existe é 404
   	# (não cai no index.html).
   	handle /assets/* {
   		root * /opt/concord/web
   		@exists file
   		header @exists Cache-Control "public, max-age=31536000, immutable"
   		file_server
   	}

   	# O resto é o app: qualquer rota (/servers/…, /dm/…) devolve o index.html,
   	# sempre revalidado para pegar a versão nova logo depois do deploy.
   	handle {
   		root * /opt/concord/web
   		header Cache-Control "no-cache"
   		try_files {path} /index.html
   		file_server
   	}
   }
   ```
   O `/updates/` não entra: só o app desktop se atualiza por ele.
3. **Publicar:** `cd frontend && yarn build:web`, depois
   `scripts/deploy-vps.sh root@IP` (o deploy automático já faz os dois).
4. **Conferir:** `curl -sI https://app-salinha.bhrx.com.br/friends` responde
   `200` com o index.html, e `curl -s -o /dev/null -w '%{http_code}'
   https://app-salinha.bhrx.com.br/api/users/me` responde `401`.

As chamadas no navegador usam as mesmas portas de mídia do LiveKit (UDP 7882 e
TCP 7881) que o app desktop. No navegador não há bandeja, iniciar com o
sistema, overlay de jogo nem atualização automática (a página nova chega ao
recarregar); o seletor de tela é o do navegador, e o som da tela depende dele
(no Chrome/Edge, marque "Compartilhar áudio"; o Firefox compartilha sem som).
As notificações precisam ser liberadas em **Configurações → Notificações →
Permitir notificações**.

**Migrar sem perder nada e sem mandar `.exe` novo:**
1. Pare o backend antigo.
2. Copie o banco: `pg_dump` no antigo → `psql` na VPS, e confira as contagens.
3. No PC antigo, repasse a porta do backend para a VPS:
   `docker run -d --restart unless-stopped --name concord-relay --network host alpine/socat TCP-LISTEN:<PORT>,fork,reuseaddr TCP:<IP-da-VPS>:8080`.
   Na VPS, um bloco `:8080 { reverse_proxy 127.0.0.1:8090 }` no Caddy recebe
   esse tráfego. Assim o endereço antigo (playit) continua funcionando.
   Enquanto o repasse existir, todo mundo que chega por ele aparece com o IP
   do PC antigo e divide o limite de 30 tentativas de login a cada 5 minutos
   por IP.
4. Publique uma versão nova com o `PUBLIC_URL` da VPS. Os apps antigos se
   atualizam pelo endereço antigo e passam a falar direto com a VPS.
5. Quando todos estiverem na versão nova, desligue o repasse, o playit e o
   bloco `:8080`.

**Deploy automático (GitHub Actions):** o workflow `.github/workflows/deploy.yml`
roda a cada push/merge na `main`:
1. Roda os testes do backend, do app e do helper. Se algum falhar, para aqui.
2. Gera o instalador assinado com a próxima versão (uma acima da que já está
   publicada na VPS).
3. Gera o app web (`yarn build:web`) e publica o backend, a página de
   download, o app web e a atualização com `scripts/deploy-vps.sh`.
4. Confere que tudo subiu.

Para ligar, em **Settings → Secrets and variables → Actions**:
- **Secrets:**
  - `VPS_SSH_KEY`: uma chave SSH só para o deploy, autorizada na VPS;
  - `VPS_KNOWN_HOSTS`: saída de `ssh-keyscan <ip>`;
  - `RELEASE_KEY`: conteúdo do `backend/.release-key`.
- **Variables:**
  - `DEPLOY_ENABLED=true`;
  - `VPS_HOST=root@<ip>`;
  - `PUBLIC_URL=https://<endereço>`;
  - `SITE_URL=https://<página de download>` (opcional; padrão `https://salinha.bhrx.com.br`);
  - `WEB_URL=https://app-salinha.bhrx.com.br` (opcional): confere o app web
    depois do deploy. Ligue só depois do DNS e do bloco do Caddy prontos.

Sem `DEPLOY_ENABLED`, o workflow só roda os testes.

**Backup:** um timer do systemd roda `pg_dump` todo dia e guarda 14 dias em
`/opt/concord/backups`. O backup diário é só do banco; a mídia do chat fica em
`/opt/concord/uploads` e não entra nele. Arquivos que a limpeza horária acha
sem mensagem vão para `/opt/concord/uploads/.trash` e só são apagados depois de
7 dias; com o banco sem nenhum anexo (banco novo ou restore pendente) a limpeza
não mexe nos arquivos. Restaure o banco antes de 7 dias para não perder mídia.

**Restaurar o banco de um backup:**
1. Pare o backend: `systemctl stop concord-server`.
2. Restaure o dump com `psql` no banco do Postgres.
3. Devolva a mídia que a limpeza tenha mandado para a lixeira enquanto o banco
   estava errado: `mv /opt/concord/uploads/.trash/* /opt/concord/uploads/`.
   É seguro: o que for órfão de verdade volta para a lixeira na próxima limpeza.
4. Suba o backend: `systemctl start concord-server`.

## Segurança

Com o playit, login e mensagens trafegam **sem criptografia** (HTTP). Na VPS
com Caddy, tudo vai por HTTPS/WSS. A mídia das chamadas é sempre
criptografada (WebRTC). Numa VPS sem firewall, o `docker-compose.yml` já deixa
o Postgres e a API do LiveKit só em `127.0.0.1`.
