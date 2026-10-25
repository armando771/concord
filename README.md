# Salinha

> Chat desktop em tempo real com canais de voz, vídeo e compartilhamento de tela.

Salinha é um aplicativo de comunicação estilo Discord, construído do zero como
projeto de estudo de arquitetura. Traz servidores, canais de texto e voz, DMs,
amizades e chamadas WebRTC (voz, vídeo e compartilhamento de tela) em um cliente
desktop com tema escuro.

![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)

## 📖 Sobre o projeto

A Salinha nasceu com a ideia de entender, na prática, como funciona uma
aplicação de chat em tempo real de ponta a ponta: autenticação, permissões,
mensageria via WebSocket, presença online e chamadas P2P com WebRTC.

O objetivo **não** é competir com o Discord, e sim servir como referência de
arquitetura — do banco de dados ao cliente desktop — mantendo o código simples,
modular e fácil de evoluir.

## ✨ Funcionalidades

- **Autenticação** — cadastro/login com JWT (access + refresh) e senha com bcrypt
- **Amigos** — buscar usuários, enviar/aceitar/recusar/remover solicitações
- **Servidores** — criar, editar, listar e convidar membros (com cargos owner/admin/member)
- **Canais** — canais de **texto** e de **voz** por servidor
- **Mensagens em tempo real** — canais e DMs via WebSocket, com histórico paginado
- **Presença** — status online/offline ao vivo
- **Chamadas** — voz 1:1 e em grupo, vídeo (1:1 e multi-câmera) e
  **compartilhamento de tela com vários participantes ao mesmo tempo**
- **UI desktop** — Electron com tema escuro e fundo animado

<!-- ## 🖼️ Screenshots  (preciso de imagens/GIFs) -->

## 🧱 Stack

### Backend
| Tecnologia | Uso |
|---|---|
| Go 1.26 | Linguagem do servidor |
| Gin | Framework HTTP e roteamento |
| pgx v5 | Driver PostgreSQL |
| coder/websocket | WebSocket (tempo real) |
| JWT + bcrypt | Auth (access/refresh + hash de senha) |
| PostgreSQL 17 | Banco de dados |
| Docker Compose | Postgres + LiveKit locais |
| LiveKit (SFU) | Servidor de mídia das chamadas |
| golang-migrate | Migrations versionadas (aplicadas no boot) |

### Frontend
| Tecnologia | Uso |
|---|---|
| Electron 39 | App desktop |
| electron-vite 5 | Build/dev do Electron |
| React 19 + TypeScript | Interface |
| Zustand | Estado global |
| Tailwind CSS v4 | Estilização (tokens via `@theme`) |
| react-router-dom 7 | Rotas (HashRouter) |
| livekit-client | Voz, vídeo e compartilhamento de tela (com som) via SFU |
| Vitest | Testes unitários |

## 🏗️ Arquitetura

**Monólito modular**: uma única aplicação Go, organizada por domínio. Cada
domínio expõe a mesma cadeia de responsabilidades, para que partes possam ser
extraídas depois caso a escala exija.

```text
Client (Electron/React)
  │
  ├── HTTP ────────┐
  │                ▼
  ├── WebSocket ─► Go (Gin) ──► PostgreSQL
  │                  │
  │                  └── /rtc (proxy) ─► LiveKit (sinalização)
  │
  └── mídia WebRTC (UDP/TCP) ─────────► LiveKit (SFU)
```

Cada módulo em `internal/` segue:

```text
handler      → comunicação externa (request/response)
service      → regras de negócio
repository   → persistência
model        → tipos e eventos
```

Regra de dependência: `Handler → Service → Repository → Database`.

### Estrutura do repositório

```text
concord/
├── backend/          # API em Go + WebSocket + token/proxy do LiveKit
│   ├── cmd/          # main.go
│   ├── internal/     # auth, user, friendship, server, channel, message,
│   │                 # conversation, call, websocket, database
│   └── migrations/   # SQL versionado
├── native/           # concord-audio: helper Rust do som da janela (Windows)
├── scripts/          # server-up, build/release-win, build/release-linux, deploy-vps, e2e-*
└── frontend/         # cliente Electron + React
    └── src/
        ├── main/     # processo principal do Electron
        ├── preload/  # bridge segura (IPC)
        └── renderer/ # app React (api, store, components, pages)
```

## 🚀 Como rodar

> **Hospedar para os amigos** (este PC como servidor, amigos baixam o `.exe` ou AppImage Linux x64):
> veja **[docs/HOSPEDAGEM.md](docs/HOSPEDAGEM.md)**.

### Distribuição desktop

A landing page (`site/`) oferece o instalador Windows e o AppImage Linux x64.
No deploy automático, ambos usam a mesma versão e recebem atualizações
verificadas com assinatura Ed25519.

Para preparar um release local das duas plataformas (requer Docker):

```bash
scripts/release-win.sh 0.7.0
scripts/release-linux.sh 0.7.0
```

Defina `PUBLIC_URL` no ambiente ou em `backend/.env`. Os artefatos ficam em
`frontend/dist/` e os arquivos para publicação em `backend/updates/`.
No Linux, permita a execução do AppImage e mantenha-o numa pasta sua com
permissão de escrita. Compartilhamento de tela com áudio e inicialização
automática com o sistema continuam exclusivos do Windows.

### Pré-requisitos
- Go 1.26+
- Node.js 20+ e Yarn
- Docker (Postgres + LiveKit)

### 1. Servidor (Postgres + LiveKit + backend)
```bash
cp backend/.env.example backend/.env   # ajuste segredos e portas
scripts/server-up.sh
# API em http://localhost:$PORT (padrão 8080)
```

### 2. Frontend
```bash
cd frontend
yarn
VITE_SERVER_URL=http://localhost:8080 yarn dev
# sem VITE_SERVER_URL o app aponta para http://localhost:8080
```

**No navegador** (mesmo renderer, sem Electron; o backend fica na mesma origem):
```bash
cd frontend
yarn dev:web                         # http://localhost:5175, repassa /api /ws /rtc ao backend
yarn build:web && yarn preview:web   # dist-web/ em http://localhost:4173
# WEB_BACKEND_URL=http://localhost:8090 troca o backend do repasse
```

### 3. Testes
```bash
cd backend && go test ./...
# Testes que usam o Postgres de verdade (migrations, cargos e permissões); só rodam
# com um banco DESCARTÁVEL em TEST_DATABASE_URL (senão são pulados):
cd backend && TEST_DATABASE_URL=postgres://usuario:senha@localhost:5432/teste go test -p 1 ./...
cd frontend && yarn test
# E2E dos cargos em tempo real (backend ligado + banco descartável; Node 22+):
node scripts/e2e-roles-ws.mjs
# E2E de chamadas (dois navegadores com mídia fake) — ver cabeçalho do script:
node scripts/e2e-voice.mjs
# E2E do deploy sem queda: reinicia o backend no meio da chamada (Caddy + LiveKit
# locais) e confere voz, tela, LIVE, mudo e chat — ver cabeçalho do script:
node scripts/e2e-restart-call.mjs
# E2E do app web (login, DM com imagem, notificação, chamada + tela, reload, logout):
APP=http://localhost:4173/ node scripts/e2e-web.mjs
# E2E da supressão de ruído (RNNoise) e o RNNoise offline sobre um WAV:
node scripts/e2e-noise.mjs
node scripts/rnnoise-offline.mjs entrada.wav saida.wav
```

## 🔌 API (resumo)

Autenticação via header `Authorization: Bearer <access_token>` (exceto rotas públicas de auth).

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | criar conta |
| POST | `/api/auth/login` | login (retorna access + refresh) |
| POST | `/api/auth/refresh` | renovar access token |
| POST | `/api/auth/logout` | encerrar sessão |
| GET | `/api/users/me` | usuário autenticado |
| GET | `/api/users/search?username=` | buscar usuários |
| ... | `/api/friends/*` | solicitações, lista, pendentes |
| ... | `/api/servers/*` | servidores, membros, convites |
| ... | `/api/servers/:id/channels` | canais (texto/voz) |
| ... | `/api/channels/:channelId/messages` | mensagens de canal |
| ... | `/api/conversations/*` | DMs e mensagens de DM |
| ... | `/api/calls/*` | criar/estado/encerrar chamadas |
| GET | `/api/presence?ids=` | status online |

> A lista completa de endpoints está no código (`internal/*/routes.go`).

## 📡 WebSocket

Endpoint: `GET /ws?token=<access_token>`.
O cliente entra em salas com `{"type":"subscribe","payload":{"room":"..."}}`
(`channel:`, `conversation:`, `server:`, `user:`, `call:`).

Eventos principais: `presence:update`, `message:create`, `message:delete`,
`channel:create|update|delete`, `server:update|delete`, `server:member:join|leave`,
`friend:request|accepted|declined|removed` e `call:*` (ciclo de vida das chamadas).

## 📞 Chamadas (LiveKit)

- **Ciclo de vida** pelo WebSocket do backend (`call:invite`, `call:accept`,
  `call:leave`, `call:screen`...).
- **Mídia via SFU (LiveKit)**: cada pessoa envia uma cópia de cada track para o
  servidor, que distribui para os demais — aguenta ~10 pessoas com várias telas
  ao mesmo tempo e funciona mesmo atrás de CGNAT.
- O backend emite o token da sala (`POST /api/calls/:id/token`, só para
  participantes) e faz proxy de `/rtc` para o LiveKit local.
- **Som da tela** (Windows): compartilhando uma janela, vai só o som do app
  dela (helper nativo `native/concord-audio`, WASAPI process loopback);
  compartilhando a tela inteira, o som do sistema sem o da própria Salinha.
- **Fala, mudo e ensurdecido** visíveis para todos (lista do canal e tiles).
- **Dispositivos:** escolha de microfone e saída (Configurações → Voz).

## 🖥️ App desktop

- **Segundo plano** (Windows): fechar esconde na bandeja; instância única;
  iniciar com o Windows; notificações de chamada e DM.
- **Atualização automática** servida pelo próprio servidor (`/updates/`),
  com instaladores assinados (Ed25519) — `scripts/release-win.sh`.

## 🛠️ Scripts

### Backend
```bash
go run ./cmd      # inicia a API
go build ./...    # build
go vet ./...      # análise estática
```

### Frontend
```bash
yarn dev          # desenvolvimento
yarn build        # typecheck + build
yarn lint         # eslint
yarn typecheck    # tsc
yarn test         # vitest
yarn build:win    # instalador Windows (prefira scripts/build-win.sh)
yarn build:mac    # instalador macOS
yarn build:linux  # instalador Linux
```

## 🗺️ Roadmap

- [x] Auth, usuários, amigos, servidores e canais
- [x] Chat em tempo real (canais e DMs) + presença
- [x] Chamadas de voz (1:1 e grupo)
- [x] Compartilhamento de tela multi-tela
- [x] Vídeo (1:1 e multi-câmera em grupo)
- [x] SFU (LiveKit) — mídia passa pelo servidor
- [ ] Histórico de chamadas na UI
- [ ] TLS (HTTPS/WSS) ao migrar para VPS
