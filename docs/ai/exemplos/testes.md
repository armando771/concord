# Testes

## Pipeline: rode só o necessário

| Quando | Comando | O que roda |
|---|---|---|
| a cada ciclo TDD | `node scripts/affected-tests.mjs loop` | só os testes afetados pelo diff (pacotes Go alterados e quem importa deles; `vitest related`; `.test.mjs` vizinhos) |
| antes do PR | `node scripts/affected-tests.mjs pr` | afetados + `go vet`/`typecheck` + estrutura + CRAP. Vira `full` se o diff toca código compartilhado (`cmd/`, `internal/platform/`, `internal/permission/`, `shared/`, `preload/`, `go.mod`, `package.json`) |
| mexeu em algo central, ou a pedido | `node scripts/affected-tests.mjs full` | suíte inteira |

Um teste isolado: `cd backend && go test ./internal/call -run TestAccept` ou
`cd frontend && npx vitest run src/renderer/src/features/chat/lib/mentions.test.ts`.

## Regras

- **TDD**: escreva o teste, veja ele **falhar pelo motivo certo**, depois implemente
  (skill `superpowers:test-driven-development`).
- Bug corrigido = teste que reproduz o bug, falhando antes da correção.
- Teste comportamento observável (entrada → saída, evento publicado, resposta
  HTTP), não detalhes internos.
- Go: só a stdlib (`testing`, `httptest`), testes por tabela com `t.Run`. Teste
  que precisa de Postgres pula sozinho sem `DATABASE_URL` (padrão do repo).
- TS: Vitest, arquivo `x.test.ts` ao lado de `x.ts`. Lógica fica em `lib/` (pura)
  e é testada sem React. Componente só tem teste quando tem comportamento próprio.
- Nada de `sleep` para esperar: use fake timers (`vi.useFakeTimers()`) ou
  `testing/synctest` no Go.

## Go: ruim

```go
func TestService(t *testing.T) {
	s := newServiceWithEverything(t) // banco, hub, 9 serviços
	s.Join(ctx, "c1", "u1")
	time.Sleep(200 * time.Millisecond) // espera "o suficiente"
	if len(s.calls["c1"].Participants) == 0 { // olha o mapa interno
		t.Fatal("falhou")
	}
}
```

Problemas: monta o mundo inteiro, depende de tempo real, inspeciona estado
privado e a mensagem de erro não diz o que esperava.

## Go: bom

```go
func TestServiceJoinPublicaParticipante(t *testing.T) {
	pub := &fakePublisher{}
	s := newTestService(t, withPublisher(pub)) // só o que o teste usa

	if err := s.Join(context.Background(), "c1", "u1"); err != nil {
		t.Fatalf("Join: %v", err)
	}
	want := Event{Type: "call:participant_joined", CallID: "c1", UserID: "u1"}
	if got := pub.last(); got != want {
		t.Errorf("evento = %+v, quer %+v", got, want)
	}
}
```

## TS: ruim

```ts
it('funciona', async () => {
  render(<ChatPane channelId="1" />) // monta o app inteiro
  await new Promise((r) => setTimeout(r, 500))
  expect(useChatStore.getState()).toMatchSnapshot() // snapshot de 300 linhas
})
```

## TS: bom

```ts
// features/chat/lib/mentions.test.ts: regra pura, nome diz o comportamento.
describe('mentionsUser', () => {
  it('reconhece @apelido no meio do texto', () => {
    expect(mentionsUser('oi @ana tudo bem?', 'ana')).toBe(true)
  })
  it('não confunde @ana com @anabela', () => {
    expect(mentionsUser('oi @anabela', 'ana')).toBe(false)
  })
})
```

Para padrões avançados de Go (fuzzing, `synctest`, integração), veja a skill
[golang-testing](../../../.claude/skills/golang-testing/SKILL.md).
