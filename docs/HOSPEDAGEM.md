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
   (ex.: `1-2-3-4.sslip.io` aponta para `1.2.3.4`). O `/etc/caddy/Caddyfile`
   é o [`deploy/Caddyfile`](../deploy/Caddyfile) do repositório, com o seu
   endereço no lugar de `1-2-3-4.sslip.io` (veja
   [Caddyfile](#caddyfile-sinalização-das-chamadas-direto-no-livekit)).
   O Caddy tira o certificado sozinho. Precisa do Caddy **2.7 ou mais novo**
   (`caddy version`; se o `apt` da distribuição trouxer um mais velho, instale
   pelo repositório oficial do Caddy). O arquivo precisa ser legível pelo
   usuário `caddy` (`chmod 644`).
5. **Serviço do backend:** `/etc/systemd/system/concord-server.service`, com
   `WorkingDirectory=/opt/concord`, `ExecStart=/opt/concord/concord-server` e
   `Restart=always`, mais o complemento
   [`deploy/concord-server.service.d/zero-downtime.conf`](../deploy/concord-server.service.d/zero-downtime.conf)
   em `/etc/systemd/system/concord-server.service.d/` (`KillSignal=SIGTERM`,
   `TimeoutStopSec=20`, `RestartSec=1`; veja
   [Reinício sem queda](#reinício-do-backend-sem-queda)). Depois
   `systemctl daemon-reload && systemctl enable --now concord-server`.
6. **Do seu PC:** `scripts/deploy-vps.sh root@IP` envia o backend, as
   migrations, o compose, a página de download (`site/`) e as atualizações
   do app, e reinicia. Reiniciar não derruba quem está em chamada e, com o
   Caddyfile do repositório, nem trava a voz/tela (a sinalização vai direto
   para o LiveKit).
7. **Publicar versão do app:** `scripts/release-win.sh`, `scripts/release-linux.sh` e depois
   `scripts/deploy-vps.sh root@IP`.

### Caddyfile: sinalização das chamadas direto no LiveKit

O [`deploy/Caddyfile`](../deploy/Caddyfile) é a cópia versionada do
`/etc/caddy/Caddyfile` da VPS. O deploy **não** envia esse arquivo: mudar o
Caddy é sempre um passo manual.

- **`/rtc*` vai direto para o LiveKit** (`127.0.0.1:7880`, o `LIVEKIT_PORT`),
  sem passar pelo backend. Antes, a sinalização do LiveKit passava pelo
  backend: cada deploy cortava essa conexão, o cliente fazia um "ICE restart"
  e a voz e a tela de todo mundo travavam por 0,3–1 s ao mesmo tempo.
- O app já pede `/rtc` no mesmo endereço da API (`wss://<endereço>/rtc/v1`),
  então os apps instalados passam a usar a rota nova **sem atualizar**.
- **Todo bloco de site que serve o app precisa da rota `/rtc*`**: o endereço
  da API (`PUBLIC_URL`), a versão web (ex.: `app-salinha.bhrx.com.br`) e
  qualquer repasse antigo (ex.: o bloco `:8080` da migração). Basta pôr
  `import salinha_rtc` no começo do bloco, antes dos outros `handle`. Um bloco
  sem ela continua funcionando pelo proxy `/rtc` do backend, mas volta a travar
  a voz a cada deploy.
- `stream_close_delay 12h`: recarregar o Caddy (`systemctl reload caddy`) não
  corta mais os WebSockets abertos (chat e chamadas).
- O proxy `/rtc` do backend continua existindo para o PC de casa com playit
  (um túnel TCP só, sem Caddy) e para blocos sem a rota. Lá, reiniciar o
  backend ainda trava a voz por um instante.

**Aplicar o Caddyfile (uma vez, com ninguém em chamada):** o
`stream_close_delay` só protege conexões abertas por uma configuração que já o
tem. O reload que aplica este arquivo pela primeira vez **fecha todos os
WebSockets uma vez**: o chat reconecta sozinho, mas quem estiver em chamada
perde a sinalização e a chamada reconecta (ou cai). Faça quando ninguém estiver
em chamada:

```bash
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
# edite /etc/caddy/Caddyfile a partir do deploy/Caddyfile (endereços e portas)
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
curl -s -o /dev/null -w '%{http_code}\n' https://<endereço>/rtc/validate   # 401 (é o LiveKit)
```

Depois disso, reloads do Caddy não derrubam ninguém.

### Reinício do backend sem queda

O deploy reinicia o backend (`systemctl restart concord-server`). Com o
SIGTERM, o backend:

1. para de aceitar conexões (as novas esperam no Caddy pelo processo novo);
2. fecha o WebSocket do chat de cada app com o código **1012** ("servidor
   reiniciando"), sem tirar ninguém da chamada nem marcar ninguém offline;
3. termina as requisições em andamento (uploads inclusive) em até 10 s e sai.

O processo novo recarrega as chamadas do banco e só então abre a porta. O app,
ao receber o 1012, reconecta em 100–300 ms (em vez de 1 s, 2 s, 4 s…) e não
mostra aviso. "Reconectando ao servidor…" só aparece se a conexão ficar fora
por mais de 3 s.

`GET /healthz` responde `200` só com o servidor pronto (banco respondendo e
chamadas recarregadas) e `503` enquanto sobe ou desliga. Não aparece no log.

**As requisições esperam em vez de falhar.** No Caddy (`salinha_backend` do
[`deploy/Caddyfile`](../deploy/Caddyfile)):

- `lb_try_duration 15s` e `lb_try_interval 100ms`: enquanto a porta do backend
  está fechada, o Caddy tenta de novo a cada 100 ms por até 15 s, em vez de
  devolver 502. Vale para qualquer método (POST e uploads inclusive), porque só
  repete o que nem chegou a conectar;
- `health_uri /healthz` (a cada 500 ms, duas falhas seguidas): só manda tráfego
  para um backend pronto.

O deploy espera o `/healthz` responder (até 30 s) em vez de um `sleep` fixo e,
se o backend não subir, mostra o fim do `journalctl` e falha.

O systemd precisa esperar esse desligamento: `TimeoutStopSec` maior que os
10 s do backend. Na VPS, instale o complemento uma vez (não reinicia nada):

```bash
mkdir -p /etc/systemd/system/concord-server.service.d
cp zero-downtime.conf /etc/systemd/system/concord-server.service.d/   # deploy/concord-server.service.d/
systemctl daemon-reload
systemctl show concord-server -p KillSignal -p TimeoutStopUSec -p RestartUSec
```

No PC de casa, `scripts/install-services.sh` já gera o serviço com isso.

### Postgres e LiveKit não são recriados no deploy

O LiveKit roda sem Redis: as salas só existem na memória dele, então
**recriar o container do LiveKit derruba todas as chamadas**. Recriar o
Postgres derruba o backend por alguns segundos. Por isso o deploy:

- sobe só o que estiver parado ou faltando (`docker compose up -d --no-recreate`);
- compara a configuração nova de cada serviço (o hash que o Compose usa para
  decidir recriar) com a dos containers rodando. Se algo mudou no
  `docker-compose.yml` ou no `/opt/concord/.env` (imagem, portas, `LIVEKIT_*`,
  `POSTGRES_*`), ele **avisa, mantém o compose antigo e segue só com o
  backend**. No GitHub Actions o aviso aparece como *warning* no resumo do job;
- só recria com `--infra`. Rode quando ninguém estiver em chamada:
  ```bash
  scripts/deploy-vps.sh --infra root@IP
  ```

As imagens têm versão fixa (`postgres:17.11`, `livekit/livekit-server:v1.13.10`).
Trocar a versão é uma mudança de infraestrutura como qualquer outra: entra no
próximo `--infra`. Comentários YAML no compose não contam, mas o texto dentro
do `LIVEKIT_CONFIG` (comentários inclusive) vira variável do container e conta.

**Página de download:** `site/` é uma página estática que lê
`/updates/latest.yml` (Windows) e `/updates/latest-linux.yml` (Linux) e aponta
cada botão para o artefato correspondente. A falha de um manifesto não bloqueia
o download da outra plataforma. O deploy mantém os três instaladores Windows
e três AppImages mais recentes. No Caddyfile, um domínio próprio serve a
página e repassa `/updates/` ao backend (bloco `salinha.exemplo.com` do
[`deploy/Caddyfile`](../deploy/Caddyfile)). Ele não serve o app, então não
precisa da rota `/rtc*`.
Para um endereço antigo continuar funcionando, um bloco
`antigo.exemplo.com { redir https://salinha.exemplo.com{uri} permanent }`
basta. O domínio precisa de um registro DNS `A` apontando para o IP da VPS (no
Cloudflare, com o proxy desligado — nuvem cinza — por causa do tamanho do
instalador).

**Migrar sem perder nada e sem mandar `.exe` novo:**
1. Pare o backend antigo.
2. Copie o banco: `pg_dump` no antigo → `psql` na VPS, e confira as contagens.
3. No PC antigo, repasse a porta do backend para a VPS:
   `docker run -d --restart unless-stopped --name concord-relay --network host alpine/socat TCP-LISTEN:<PORT>,fork,reuseaddr TCP:<IP-da-VPS>:8080`.
   Na VPS, um bloco `:8080 { reverse_proxy 127.0.0.1:8090 }` no Caddy recebe
   esse tráfego. Assim o endereço antigo (playit) continua funcionando.
4. Publique uma versão nova com o `PUBLIC_URL` da VPS. Os apps antigos se
   atualizam pelo endereço antigo e passam a falar direto com a VPS.
5. Quando todos estiverem na versão nova, desligue o repasse, o playit e o
   bloco `:8080`.

**Deploy automático (GitHub Actions):** o workflow `.github/workflows/deploy.yml`
roda a cada push/merge na `main`:
1. Roda os testes do backend, do app e do helper. Se algum falhar, para aqui.
2. Gera o instalador assinado com a próxima versão (uma acima da que já está
   publicada na VPS).
3. Publica o backend, a página de download e a atualização com
   `scripts/deploy-vps.sh`.
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
  - `SITE_URL=https://<página de download>` (opcional; padrão `https://salinha.bhrx.com.br`).

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
