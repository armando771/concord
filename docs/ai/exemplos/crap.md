# CRAP ≤ 15

`CRAP = complexidade² × (1 − cobertura)³ + complexidade`

- **Complexidade** ciclomática: 1 + cada `if`, `for`, `case`, `&&`, `||` (no TS
  também `while`, `catch`, `?:` e `??`).
- **Cobertura**: fração dos statements da função que rodaram nos testes.

| Complexidade | Sem teste (0%) | 50% | 100% |
|---|---|---|---|
| 3 | 12 ✅ | 4.1 ✅ | 3 ✅ |
| 4 | 20 ❌ | 6 ✅ | 4 ✅ |
| 8 | 72 ❌ | 16 ❌ | 8 ✅ |
| 16 | 272 ❌ | 48 ❌ | 16 ❌ |

Conclusões práticas:

- função com complexidade **até 3** passa mesmo sem teste (cola, wiring);
- de **4 a 15** passa se estiver bem testada;
- **acima de 15 nunca passa**, nem com 100% de cobertura: tem que quebrar.

## Como medir

```bash
node scripts/crap.mjs --files backend/internal/call/service.go   # baseline, antes de mexer
node scripts/crap.mjs                                            # depois: só as funções tocadas no diff
```

As funções tocadas que passarem de 15 fazem o script falhar. As outras do
mesmo arquivo aparecem como aviso. Cole as duas tabelas (antes e depois) no PR.

## Ruim: complexidade alta e sem teste (CRAP 156)

```go
func (s *Service) Accept(ctx context.Context, callID, userID string) error {
	call, ok := s.calls[callID]
	if !ok {
		return ErrNotFound
	}
	if call.Status != StatusRinging && call.Status != StatusActive {
		return ErrNotRinging
	}
	if call.Kind == KindDM {
		if !call.IsInvited(userID) {
			return ErrForbidden
		}
	} else if call.Kind == KindChannel {
		if ok, _ := s.perms.Can(ctx, call.ChannelID, userID, permission.Connect); !ok {
			return ErrForbidden
		}
		if call.Full() && !s.perms.Bypass(userID) {
			return ErrFull
		}
	}
	// ... mais 40 linhas: estado, eventos, LiveKit
}
```

## Bom: regras extraídas e testadas por tabela

```go
// Cada regra é uma função pequena e pura (complexidade 2–4).
func canJoinDM(call *Call, userID string) error {
	if !call.IsInvited(userID) {
		return ErrForbidden
	}
	return nil
}

func canJoinChannel(call *Call, allowed, bypass bool) error {
	if !allowed {
		return ErrForbidden
	}
	if call.Full() && !bypass {
		return ErrFull
	}
	return nil
}

func (s *Service) Accept(ctx context.Context, callID, userID string) error {
	call, err := s.ringingCall(callID)
	if err != nil {
		return err
	}
	if err := s.checkJoin(ctx, call, userID); err != nil {
		return err
	}
	return s.join(ctx, call, userID)
}
```

```go
func TestCanJoinChannel(t *testing.T) {
	tests := []struct {
		name            string
		full, allowed   bool
		bypass          bool
		want            error
	}{
		{"sem permissão", false, false, false, ErrForbidden},
		{"cheia sem bypass", true, true, false, ErrFull},
		{"cheia com bypass", true, true, true, nil},
		{"com vaga", false, true, false, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			call := &Call{Limit: 1}
			if tt.full {
				call.Participants = []string{"x"}
			}
			if got := canJoinChannel(call, tt.allowed, tt.bypass); got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}
```

## TS: ruim e bom

```ts
// Ruim: ternários e && empilhados (complexidade 11, sem teste: CRAP 132).
export function badgeLabel(u: User, me: string, live?: Live, muted?: boolean) {
  return u.id === me ? (live ? (muted ? 'Você (ao vivo, mudo)' : 'Você (ao vivo)') : 'Você')
    : u.bot ? 'Bot' : live && !muted ? 'Ao vivo' : u.status === 'idle' ? 'Ausente' : u.status ?? ''
}

// Bom: tabela de casos + funções de uma decisão só.
const STATUS_LABEL: Record<Status, string> = { online: '', idle: 'Ausente', dnd: 'Não perturbe', offline: '' }

function selfLabel(live?: Live, muted?: boolean): string {
  if (!live) return 'Você'
  return muted ? 'Você (ao vivo, mudo)' : 'Você (ao vivo)'
}

export function badgeLabel(u: User, me: string, live?: Live, muted?: boolean): string {
  if (u.id === me) return selfLabel(live, muted)
  if (u.bot) return 'Bot'
  if (live && !muted) return 'Ao vivo'
  return STATUS_LABEL[u.status]
}
```
