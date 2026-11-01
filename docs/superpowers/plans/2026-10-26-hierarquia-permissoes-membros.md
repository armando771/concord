# Plano de Implementação: Hierarquia de Permissões e Desconectar Membros

> Data: 2026-10-26  
> Branch: `feat/permissoes-hierarquia-membros`  
> Base: `upstream/develop`

## 1. Contexto e Requisitos

Definir e ajustar o que usuários com mesmo nível de cargo ou hierarquia superior podem fazer:

1. **Administrador**:
   - Fica em aba/seção separada **acima** de "Geral", com o título "Administrador".
   - Quando marcado, todas as permissões são marcadas (permissão de tudo).
   - Enquanto Administrador está ativo, todas as outras permissões ficam desabilitadas para edição e marcadas.
2. **Expulsar Membros**:
   - Usuário só expulsa se tiver cargo de maior hierarquia que o alvo (`actorHighest > targetHighest`) e tiver a permissão `KICK_MEMBERS`.
   - Confirmação via modal antes de executar.
3. **Banir Membros**:
   - Usuário só bane se tiver cargo de maior hierarquia que o alvo (`actorHighest > targetHighest`) e tiver a permissão `BAN_MEMBERS`.
   - Confirmação via modal antes de executar.
4. **Gerenciar Apelidos**:
   - Usuário pode alterar apelido de outros membros caso tenha o mesmo cargo ou superior (`actorHighest >= targetHighest`).
   - Usuários de menor cargo **não podem** alterar usuários de nível hierárquico superior.
   - Dono é intocável (a menos que o ator seja o dono).
   - Valida que o usuário tem a permissão `MANAGE_NICKNAMES`.
5. **Alterar Apelido**:
   - Usuário altera o próprio apelido caso tenha a permissão `CHANGE_NICKNAME`.
6. **Desconectar Membros (Nova Permissão `DISCONNECT_MEMBERS`)**:
   - Nova permissão independente (bit `1 << 24`), na categoria "Canais de voz".
   - Desconecta da chamada de voz usuário de **mesmo nível de hierarquia ou menor** (`actorHighest >= targetHighest`).
   - Membro de nível inferior não pode desconectar membro de maior hierarquia (`actorHighest < targetHighest`).
   - Exige que o membro tenha a permissão `DISCONNECT_MEMBERS` no canal da chamada.
7. **Demais permissões**:
   - Seguem as regras atuais da hierarquia e escopo.

---

## 2. Refatoração Estrutural (Anti-God Files)

Antes de alterar o comportamento:
- `permissions.ts` tem 460 linhas (> 400). Extrair definições e agrupamentos de UI (`PERMISSION_GROUPS`, `channelPermissionGroups`, tipos de grupo/info) para `permissionGroups.ts`. `permissions.ts` reexporta e fica com ~250 linhas.
- `UserContextMenu.tsx` tem 641 linhas (> 400). Extrair a seção de moderação de voz e servidor para `UserContextMenuModeration.tsx`. `UserContextMenu.tsx` fica abaixo de 550 linhas.

---

## 3. Tarefas Detalhadas e TDD

### Tarefa 1: Backend - Nova Permissão `DisconnectMembers` e Funções de Hierarquia
- **Arquivos**:
  - `backend/internal/permission/perms.go`
  - `backend/internal/permission/compute.go`
  - `backend/internal/permission/snapshot.go`
  - `backend/internal/permission/testdata/vectors.json`
- **TDD / Testes**:
  - Em `backend/internal/permission/compute_test.go` e `vectors_test.go`:
    - Adicionar teste para `CanManageNicknameOf`:
      - mesmo cargo (`actorHighest == targetHighest`) -> permitido
      - cargo superior (`actorHighest > targetHighest`) -> permitido
      - cargo inferior (`actorHighest < targetHighest`) -> negado
      - alvo é dono (`target == owner`) e ator não é dono -> negado
      - ator é dono -> permitido para qualquer um
    - Adicionar teste para `CanDisconnectMember`:
      - mesmo cargo (`actorHighest == targetHighest`) -> permitido
      - cargo superior (`actorHighest > targetHighest`) -> permitido
      - cargo inferior (`actorHighest < targetHighest`) -> negado
      - alvo é dono (`target == owner`) e ator não é dono -> negado
      - ator é dono -> permitido para qualquer um
    - Atualizar `vectors.json` com bit `DISCONNECT_MEMBERS = 16777216` e moderador padrão.

### Tarefa 2: Backend - NicknameService e CallService.DisconnectParticipant
- **Arquivos**:
  - `backend/internal/server/nickname.go`
  - `backend/internal/server/nickname_test.go`
  - `backend/internal/call/permissions.go`
  - `backend/internal/call/permissions_test.go`
- **TDD / Testes**:
  - Em `server/nickname_test.go`:
    - Testar `Set` de apelido de outro usuário com mesmo cargo: agora deve ter sucesso se tiver `MANAGE_NICKNAMES`.
    - Testar `Set` de apelido de outro usuário com cargo superior: continua retornando `ErrCannotActOn`.
    - Testar `Set` do dono por outro usuário: retorna `ErrCannotActOn`.
    - Testar próprio apelido sem `CHANGE_NICKNAME`: retorna `ErrMissingPermission`.
  - Em `call/permissions_test.go`:
    - Testar `DisconnectParticipant` com ator que tem `DisconnectMembers` e mesmo cargo do alvo: sucesso.
    - Testar `DisconnectParticipant` com ator que tem `DisconnectMembers` e cargo inferior ao alvo: retorna `ErrCannotActOnMember`.
    - Testar `DisconnectParticipant` com ator sem `DisconnectMembers`: retorna `ErrMissingPermission`.

### Tarefa 3: Frontend - Permissão `DISCONNECT_MEMBERS`, Agrupamentos e Extração
- **Arquivos**:
  - `frontend/src/renderer/src/features/servers/lib/permissionGroups.ts` (novo)
  - `frontend/src/renderer/src/features/servers/lib/permissions.ts`
  - `frontend/src/renderer/src/features/servers/lib/permissions.test.ts`
- **TDD / Testes**:
  - `permissions.test.ts`:
    - Validar `Perm.DISCONNECT_MEMBERS = 1 << 24`.
    - Validar grupo `Administrador` como primeiro grupo em `PERMISSION_GROUPS`, antes de `Geral`.
    - Validar `channelPermissionGroups('voice')` contendo `DISCONNECT_MEMBERS`.
    - Validar `canManageNicknameOf` e `canDisconnectMember`.

### Tarefa 4: Frontend - `serverAccess` com Novas Regras
- **Arquivos**:
  - `frontend/src/renderer/src/features/servers/lib/serverAccess.ts`
  - `frontend/src/renderer/src/features/servers/lib/serverAccess.test.ts`
- **TDD / Testes**:
  - `serverAccess.test.ts`:
    - `canChangeNickname` para mesmo cargo: `true` quando tem `MANAGE_NICKNAMES`.
    - `canChangeNickname` para cargo superior: `false`.
    - `canChangeNickname` para si mesmo: respeita `CHANGE_NICKNAME`.
    - `canDisconnectMember`: `true` para mesmo cargo ou menor, `false` para superior.

### Tarefa 5: Frontend - UI de `PermissionSwitches` (Aba Administrador e Edição Bloqueada)
- **Arquivos**:
  - `frontend/src/renderer/src/features/servers/components/PermissionSwitches.tsx`
  - `frontend/src/renderer/src/features/servers/components/PermissionSwitches.test.tsx` (novo)
- **TDD / Testes**:
  - Quando `value` contém `Perm.ADMINISTRATOR`:
    - Todas as demais permissões aparecem marcadas (`checked = true`).
    - Todas as demais permissões ficam desabilitadas para edição.
    - Interruptor de Administrador pode ser desmarcado.
  - Ao marcar Administrador:
    - `onChange` é chamado marcando todas as permissões (`ALL_PERMISSIONS`).
  - Ao desmarcar Administrador:
    - Permissões voltam a ser editáveis.

### Tarefa 6: Frontend - Moderação e Menus (`UserContextMenuModeration`)
- **Arquivos**:
  - `frontend/src/renderer/src/features/profile/components/UserContextMenuModeration.tsx` (novo)
  - `frontend/src/renderer/src/features/profile/components/UserContextMenuModeration.test.tsx` (novo)
  - `frontend/src/renderer/src/features/profile/components/UserContextMenu.tsx`
- **TDD / Testes**:
  - `UserContextMenuModeration`:
    - Exibe `Desconectar da chamada` quando tem `DISCONNECT_MEMBERS` e alvo no mesmo nível ou menor.
    - Exibe `Expulsar` e `Banir` apenas com maior hierarquia, abrindo o modal de confirmação correspondente (`askKick`, `askBan`).
    - Validação de que `UserContextMenu.tsx` encolheu.

### Tarefa 7: Verificação Geral (Anti-god, CRAP <= 15, Testes Afetados)
- Executar:
  - `node scripts/check-structure.mjs --base upstream/develop`
  - `node scripts/crap.mjs --base upstream/develop`
  - `node scripts/affected-tests.mjs pr --base upstream/develop`
- Corrigir qualquer apontamento até tudo ficar verde.
