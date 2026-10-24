# Hospedar o Concord para os amigos

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
   | Concord API | TCP | o `PORT` do `.env` (padrão 8080) |
   | Concord mídia | **UDP** | **igual à porta pública** que o playit der |
   | Concord mídia TCP | TCP | **igual à porta pública** que o playit der |

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
**Concord API** (ex.: `http://abc-api.gl.at.ply.gg:12345`) e rode:

```bash
scripts/release-win.sh          # ou: scripts/release-win.sh 0.3.0
```

O script faz quatro coisas:

1. Na primeira vez, gera a **chave de assinatura** em `backend/.release-key`.
   Faça backup dela e não compartilhe: sem ela, os apps já instalados recusam
   as atualizações.
2. Sobe a versão em `frontend/package.json`.
3. Gera e assina o instalador com o endereço e a chave pública embutidos.
4. Publica tudo em `backend/updates/`, que o backend serve em `/updates/`.

**Primeira vez de cada amigo:** mande `frontend/dist/Concord-<versão>-setup.exe`.
Como o app não é assinado, o Windows mostra "O Windows protegeu o
computador". Basta clicar em **Mais informações → Executar assim mesmo**.

**Depois disso, não precisa mandar mais nada.** Para cada versão nova, rode
`scripts/release-win.sh` de novo:

- O app checa atualizações ao abrir e a cada 5 minutos.
- Ele baixa a versão nova em segundo plano, mas só fora de chamada, porque o
  upload do servidor é o mesmo das chamadas.
- Instaladores sem assinatura válida são recusados.
- Se já estava baixada, a atualização instala ao abrir o app. Com o app aberto,
  aparece **"Nova atualização disponível"** no canto inferior direito, com o
  botão **Atualizar**.

> `scripts/build-win.sh <endereço>` ainda gera um `.exe` avulso (portable +
> instalador), mas sem atualização automática.

### No app (Windows)

- **Fechar a janela** deixa o app na bandeja, como o Discord. Para fechar de
  vez, use **Sair** no ícone da bandeja.
- **Iniciar com o Windows** vem ligado e pode ser desligado nas configurações.
- **Configurações → Voz:** escolha do microfone e da saída de som.
- **Som da tela compartilhada:**
  - Ao compartilhar uma **janela**, vai só o som do app dela (Windows 10 2004
    ou mais novo).
  - Ao compartilhar a **tela inteira**, vai o som do PC todo, menos o Concord.

## 6. Testar

- Você (no desktop) e um amigo de **outra rede**: criar conta, virar amigos,
  entrar num canal de voz.
- Duas pessoas compartilhando tela ao mesmo tempo, com som de jogo/vídeo.
- Se a chamada abre mas fica sem áudio/vídeo, quase sempre é porta local ≠
  porta pública no túnel de mídia, ou `LIVEKIT_NODE_IP` errado. Veja
  `docker logs concord-livekit`.
- Quem está na **mesma rede** que o servidor (o seu desktop) conecta a mídia
  direto pela rede local, sem passar pelo playit.

## 7. Se o playit não ficar bom: VPS no Brasil

O código não muda, só a configuração:

1. VPS em São Paulo com IP fixo. Atenção à cota de tráfego: ~2–3 TB/mês numa
   rotina de 10 pessoas com telas.
2. Túnel WireGuard VPS ↔ este PC, e a VPS repassando (DNAT) a porta do backend
   (TCP) e as portas de mídia (UDP e TCP) para o PC.
3. `.env`: `LIVEKIT_NODE_IP` = IP da VPS; portas iguais às repassadas.
4. Opcional, recomendado: Caddy na VPS com domínio para ter HTTPS. Aí o
   build usa `https://seu-dominio` e o app passa a usar `wss://` sozinho.
5. Gere o `.exe` de novo com o novo endereço e mande para os amigos.

## Segurança

Com o playit, login e mensagens trafegam **sem criptografia** (HTTP). A
mídia das chamadas é sempre criptografada (WebRTC). Use senhas que não sejam
as mesmas de outros serviços até migrar para uma VPS com HTTPS.
