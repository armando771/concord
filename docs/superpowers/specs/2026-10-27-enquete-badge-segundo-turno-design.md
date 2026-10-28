# Enquete do segundo turno: escolher o badge (L, 22 ou nenhum)

Evolui o PR #317 (banner "Você fez o L?"). Substitui a pergunta sim/não por uma
**enquete de escolha única**, obrigatória, com um modal genérico que serve para
enquetes futuras. Plano anterior: `docs/superpowers/plans/2026-10-27-badge-l.md`.

## Objetivo

Quem já estava na Salinha no dia do segundo turno (25/10/2026) escolhe, uma só
vez, o badge de lembrança: **Fez o L**, **Fez o 22** ou **Prefiro não dizer**
(sem badge). O modal não fecha até a pessoa responder. A mecânica do modal e do
armazenamento é reaproveitável para outras enquetes.

Sucesso: cada pessoa elegível responde uma vez; L e 22 ganham o badge com a
mesma celebração; "nenhum" não deixa rastro visível para ninguém; adicionar uma
enquete nova é uma entrada de código, sem migration nem componente novo.

## Decisões

| Decisão | Por quê |
|---|---|
| Elegível: conta criada antes de 26/10/2026 00:00 (Brasília), ou seja, até o fim de 25/10 | "Quem já estava no servidor no dia" |
| Escolha definitiva, com confirmação em dois passos para as três opções | Modal obrigatório + sem desfazer: um clique errado não pode valer. "Nenhum" também é definitivo |
| Os dois lados têm o mesmo peso: badges `l` e `v22` Lendários, mesma celebração e mesmo tamanho de botão | Evita um recurso de um lado só |
| "Prefiro não dizer" é a saída do modal e não gera badge nem reação triste | Ninguém é forçado a se declarar; a reação triste soaria como julgamento |
| Modal sem X, sem Esc e sem fechar clicando fora, com foco preso | Pedido explícito: obrigatório. A saída acessível é a opção "Prefiro não dizer" |
| Abordagem C: enquete definida em código Go, tabela `escolhas`, modal genérico | Atende o reaproveitamento sem painel de admin (descartados: A só troca o booleano; B enquetes configuráveis é exagero) |
| A migration `000066` do #317 é trocada, não acrescentada | O #317 não foi para produção |
| `Refresh` roda com `context.WithoutCancel`; o "sim" recarrega os badges sem esperar o websocket | Correções da revisão do #317, mantidas |
| Tudo entra no PR #317 | Mesma feature, ainda não mesclada |

Pesquisa (padrões): modal de escolha como fluxo à parte
([Usertour](https://docs.usertour.io/use-cases/choose-between-two-tours)),
resposta gravada no servidor para não repetir
([ServiceNow](https://www.servicenow.com/docs/r/VSGj5uf15r1UFmxfhJoyeg/C6ZUtGSwPUBlrc4sgvGTAA)),
diálogo sem Esc quando exige confirmação
([FLOE](https://handbook.floeproject.org/ModalDialogs.html)). Nenhum ADR: segue o
padrão do repo (categoria exclusiva lida de tabela, como `criador`).

## Arquitetura

### Backend

- **Migration `000066_escolhas`** (troca a atual, com `.down`):
  `escolhas(user_id UUID REFERENCES users ON DELETE CASCADE, enquete TEXT, opcao TEXT,
  respondido_em TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (user_id, enquete))`.
- **`internal/segundoturno` → `internal/enquete`** (rename em commit próprio).
  - `model.go`: `Enquete{ID, Titulo, Descricao, Corte, Opcoes}` e
    `Opcao{ID, Rotulo, Badge}` (`Badge` é a categoria concedida, vazio = nenhuma).
  - `definicoes.go`: `SegundoTurno` com `ID "segundo-turno"`, `Corte` 2026-10-26
    00:00 BRT e as opções `l` (badge `l`), `22` (badge `v22`) e `nenhum`.
  - `service.go`: `Pendentes(userID)` (elegível e sem resposta) e
    `Responder(userID, enqueteID, opcaoID)`. Erros: `ErrEnqueteInexistente`,
    `ErrOpcaoInvalida`, `ErrNaoElegivel`, `ErrJaRespondeu`,
    `ErrUsuarioNaoEncontrado`. Se a opção tem `Badge`, chama `Refresh`
    (`context.WithoutCancel`).
  - `repository.go`: `Carregar` (data da conta + respostas) e `Gravar`
    (`ON CONFLICT DO NOTHING`, devolve se gravou).
  - `handler.go`/`routes.go`:
    - `GET /users/me/enquetes` → `{"enquetes":[{id,titulo,descricao,opcoes:[{id,rotulo,badge}]}]}`
      (só as pendentes).
    - `POST /users/me/enquetes/:id` `{"opcao":"l"}` → `{"enquete","opcao","badge"}`.
    - Status: 400 opção inválida ou corpo vazio, 401, 403 fora do corte,
      404 enquete ou usuário inexistente, 409 já respondeu.
- **`internal/badge`**:
  - `Stats.Escolhas map[string]bool` com chaves `"enquete:opcao"`, lido em
    `Repository.Stats` (`SELECT enquete || ':' || opcao FROM escolhas WHERE user_id = $1`).
  - `Stats.FezOL` sai; `valueFns["l"]` e `valueFns["v22"]` consultam
    `Escolhas["segundo-turno:l"]` e `["segundo-turno:22"]`.
  - Catálogo: `l` (já existe) e **`v22`** ("Fez o 22"), ambos `Exclusive`,
    `UnitVote`, `RarityLegendary`.
  - `cmd/wire_engagement.go`: passa a ligar `enquete.*`.

### Frontend (`features/enquete/`)

- `api/enquete.ts`: `fetchPendentes()` e `responderEnquete(id, opcao)`.
- `lib/enquete.ts` (puro, com teste): `fase(estado)` (`oculto`, `pergunta`,
  `confirmacao`, `celebracao`, `neutra`), `podeContinuar(selecao)`,
  `badgeDaOpcao(opcao)`.
- `store/enqueteStore.ts` (store novo, nenhum god store muda): `userId`,
  `pendentes`, `selecao`, `etapa`, `enviando`, `erro`, `reacao`; ações
  `carregar`, `selecionar`, `continuar`, `voltar`, `confirmar`, `fecharReacao`,
  `reset`. Descarta respostas atrasadas depois de trocar de conta; 403/409
  recarregam as pendentes; o "sim" recarrega os badges (`ensureBadges`).
- `components/`: `EnqueteHost` (monta a próxima pendente; tenta de novo ao voltar
  o foco da janela), `EnqueteModal` (`role="dialog"`, `aria-modal`, foco preso,
  sem X nem Esc), `EnqueteOpcoes` (rádios), `EnqueteConfirmacao`,
  `EnqueteCelebracao` (reaproveita a animação atual com o badge da opção),
  `EnqueteNeutra`. `assets/segundoTurno.css` vira `assets/enquete.css`.
- `levels/lib/badges.ts`: `unlocksComAviso` ignora `l` e `v22` (a celebração
  própria cobre).
- **Sai**: botão "L" da `ServerRail` (arquivo volta ao original), dispensa em
  localStorage, `SegundoTurnoBanner`, reação triste.
- `AppShell.tsx`: troca `SegundoTurnoHost` por `EnqueteHost` (uma linha).

### Responsivo e acessibilidade

Cartão `w-full max-w-sm` com margem de 16 px; `overflow-y-auto` se a altura
faltar; alvos de 44 px; opções empilhadas; `prefers-reduced-motion`; foco inicial
na primeira opção e devolvido ao fechar a celebração. A celebração fecha sozinha
em 6 s e o aviso neutro em 4,5 s (ambos também fecham por botão, X e Esc). Conferir
em 360, 768 e 1280 px.

### Testes

- Go (stdlib): serviço (pendentes, elegibilidade, opção inválida, 409, corrida,
  `Refresh` só quando há badge, contexto cancelado), handler (todos os status),
  `Evaluate` para `l` e `v22` (aparecem só para quem escolheu) e invariantes do
  catálogo.
- Frontend: `lib`, store (fluxo, confirmação, 409, troca de conta, falha,
  retry no foco), componentes com `renderToStaticMarkup`.
- Repositórios SQL (`Carregar`, `Gravar`, `Stats`): verificados no teste de ponta
  a ponta com Postgres real.

## Textos aprovados

- **Pergunta:** "Escolha o seu badge do segundo turno" / "Você já estava na
  Salinha no dia, então pode escolher um badge de lembrança. A escolha é
  definitiva."
- **Opções:** "Fez o L", "Fez o 22", "Prefiro não dizer".
- **Botões:** "Continuar". Confirmação: "Confirmar: {opção}?" / "Não dá para
  mudar depois." com "Confirmar" e "Voltar".
- **Celebração:** "Badge conquistado!" e o nome do badge.
- **Aviso neutro:** "Tudo certo! Sua escolha foi guardada." e "Fechar".
- **Erro de envio:** "Não foi possível enviar. Tente de novo."
- **Badges:** "Fez o L" e "Fez o 22". Descrição: "Fez o L no segundo turno.
  Ganho escolhendo o badge do segundo turno." (e "Fez o 22 ..." no outro).
- **Changelog** (`changelog/next.md`, substitui a linha do #317): "Badges: quem
  já estava na Salinha até 25/10/2026 escolhe um badge do segundo turno (Fez o L,
  Fez o 22 ou nenhum). A escolha é definitiva."

## Arte

A arte dos badges `l` e `v22` (256 px e 64 px, `.webp` em `assets/badges/`) vem
do usuário; direção sugerida: estrela vermelha **original**, sem o logo de
partido. Até lá aparece o ícone genérico.

## Fora de escopo

Trocar a escolha depois; painel de admin para criar enquetes; mostrar totais ou
resultados; enquetes com várias perguntas; badge para "Prefiro não dizer";
migrar respostas do #317 (não há produção).

## Verificação de ponta a ponta

Com Postgres real (`scripts/server-up.sh`), backend e `yarn dev:web`:

1. Duas contas: uma com `created_at` antes de 26/10/2026 00:00 BRT e outra depois
   (ajustado por SQL). Só a primeira vê o modal.
2. Esc, clique fora e Tab não tiram do modal; só a escolha (com confirmação) o fecha.
3. Escolher L e escolher 22 (contas diferentes): celebração com o badge certo,
   badge no perfil para outras pessoas, sem toast duplicado.
4. "Prefiro não dizer": aviso neutro, nenhum badge e nada visível para os outros.
5. Segundo `POST` devolve 409 e o app só recarrega.
6. Fora do corte, `POST` devolve 403; opção inexistente, 400.
7. Capturas em 360, 768 e 1280 px; `node scripts/affected-tests.mjs pr` verde com
   CRAP antes e depois.
