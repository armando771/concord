# Changelog global — design

Página acessível a todos os usuários que mostra, por versão, o que cada release trouxe (novidades e correções).

## Decisões

- **Fonte:** banco de dados + endpoint (não arquivo embutido no app).
- **Publicação:** o deploy da `main` publica a release via endpoint protegido por token; não há admin global nem tela de edição.
- **Retroativo:** as ~30 releases já feitas (merges de `develop` na `main`, PRs #18 a #161) são montadas a partir dos commits e gravadas por migration de seed.
- **Numeração retroativa:** a versão não é gravada no git (o deploy calcula `patch + 1` sobre a publicada, ver `scripts/next-version.mjs`). A release mais recente recebe a versão publicada hoje (`latest.yml` do servidor) e as anteriores contam para trás, `-1` no patch.
- **Acesso:** ícone no ServerRail, abaixo de Propostas, abre `/changelog` (1 clique de qualquer tela).

## 1. Backend (`backend/internal/changelog`)

Migration nova:

- `changelog_releases`: `id`, `version` (único), `released_at`, `summary` (opcional).
- `changelog_entries`: `id`, `release_id` (FK), `kind` (`feature` | `fix`), `text`, `position`.

Endpoints:

- `GET /api/changelog` (autenticado): releases da mais nova para a mais antiga, com as entradas. Sem paginação (YAGNI).
- `PUT /api/changelog/{version}`: publica uma release. Exige o header com `CHANGELOG_TOKEN` (env do servidor, secret do GitHub). Idempotente: repetir substitui as entradas da mesma versão, sem duplicar.

## 2. Publicação no deploy

- O PR de release traz `changelog/next.md` com `## Novidades` e `## Correções` em bullets. Cada PR de feature/fix acrescenta sua linha.
- No `deploy.yml`, depois de confirmar a versão no ar (checagem dos `latest*.yml`), um passo converte o `.md` em JSON, faz o `PUT` e esvazia o `next.md`.
- `next.md` vazio: publica a release sem entradas e avisa no log, sem derrubar o deploy.

## 3. Retroativo

- Ler os commits de cada merge de `develop` na `main` e escrever as entradas em português, em linguagem de usuário, separando novidade e correção. Ignorar o que não é visível (CI, refactor, docs).
- Ancorar a numeração na versão publicada hoje.
- Gravar em `backend/migrations/…_seed_changelog.up.sql`.
- O texto voltado ao usuário passa por aprovação do solicitante antes de ser gravado.

## 4. Frontend

- Rota `/changelog` em `router.tsx`, página em `pages/Changelog.tsx`.
- Ícone novo no `ServerRail.tsx`, abaixo de Propostas.
- Lista da mais nova para a mais antiga: cabeçalho "vX.Y.Z · data", grupos **Novidades** e **Correções** com selo de cor por tipo. A versão em uso recebe o destaque "Você está aqui".
- A versão instalada vem do Electron (`app.getVersion()`, via IPC `update:current-version`); na web não há destaque.
- Sem atalhos extras (Configurações não mostram versão hoje; o ServerRail já dá acesso em 1 clique).

## Testes

- Go: handler (token inválido, idempotência, ordenação).
- Vitest: renderização da página (grupos, destaque da versão atual, lista vazia).
