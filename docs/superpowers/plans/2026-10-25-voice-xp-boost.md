# Buff de XP de voz por quantidade de pessoas — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O XP de voz de quem está ganhando XP numa call multiplica conforme o número de pessoas elegíveis na call (rank A/S/SS/SSS estilo Devil May Cry), com indicação e animação escalonada no chat de voz.

**Architecture:** O `level.Service` agrupa `ActiveVoiceUsers()` por call, calcula `boostPercent(eligible)`, multiplica o XP ao fechar o minuto e manda `voice:boost` (heartbeat a cada tick enquanto há buff) para o room `call:<id>`. No cliente, um `boostStore` guarda o buff por call e dispara o banner de ativação; `StyleRank` (letra + texto + multiplicador) aparece em `VoiceXPBar` e no cabeçalho de `VoiceChannelView`; `BoostBanner` toca a animação de entrada, que escala com o rank.

**Tech Stack:** Go (backend, testes `go test`), React + TypeScript + zustand + Tailwind v4 + CSS keyframes (frontend, testes vitest em ambiente node).

## Global Constraints

Valores copiados do spec `docs/superpowers/specs/2026-10-25-voice-xp-boost-design.md`:

- Conta só quem está elegível (`call.eligibleVoiceUsers`: call ativa, sem mute, sem surdo, com mais alguém ouvindo).
- Faixas: 0–3 → 100; 4–5 → 125 (A, "Alright!"); 6–7 → 150 (S, "Sweet!"); 8–9 → 175 (SS, "Showtime!"); 10+ → 200 (SSS, "Smokin' Sexy Style!").
- XP creditado = `minutes * XPPerMinute * percent / 100` (inteiros), com o percentual do instante em que o minuto fecha.
- Evento `voice:boost`, payload `{call_id, percent, eligible}`, via `BroadcastToCall`; heartbeat a cada tick enquanto há buff; um último com `percent: 100` ao acabar; calls sem buff nunca recebem.
- O cliente descarta o buff de uma call após 25 s sem heartbeat.
- Sem migração de banco, sem lib nova de animação (só CSS/SVG, `transform`/`opacity`).
- Descer de rank não dispara banner; só sobe ou ativa.
- `prefers-reduced-motion` desliga slam, tremida, flash, partículas, glitch e pulso; fica o badge estático e o banner sem movimento.
- Só homenagem em texto e letra ao ranking do Devil May Cry: nada de fonte, logo ou arte do jogo.
- Commits em português, estilo conventional (`feat(level): …`), **sem** atribuição de Claude/IA (regra do repositório).
- Ambiente: o dev tem Go/yarn fora do PATH. Go: usar um `go.exe` portátil go1.26.x; frontend: `npx --yes yarn@1.22.22 install --frozen-lockfile --ignore-scripts` se faltar `node_modules`. Comandos abaixo assumem `go` e `npx` disponíveis.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `backend/internal/level/boost.go` (novo) | `boostPercent`, `callBoosts` (agrupa por call) — funções puras |
| `backend/internal/level/boost_test.go` (novo) | Testes das duas funções |
| `backend/internal/level/model.go` | Tipo `BoostEvent` |
| `backend/internal/level/service.go` | `grant.percent`, XP multiplicado, `lastBoost`, `publishBoosts` |
| `backend/internal/level/service_test.go` | Testes de serviço (XP, evento) |
| `frontend/src/renderer/src/lib/boost.ts` (novo) | `boostRank`, `boostLabel`: rank, textos, paleta e flags de efeito |
| `frontend/src/renderer/src/lib/boost.test.ts` (novo) | Testes de `boostRank`/`boostLabel` |
| `frontend/src/renderer/src/store/boostStore.ts` (novo) | Buff por call, expiração, celebração, preview dev |
| `frontend/src/renderer/src/store/boostStore.test.ts` (novo) | Testes do store |
| `frontend/src/renderer/src/api/ws.ts` | Tipo de evento `voice:boost` |
| `frontend/src/renderer/src/store/chatStore.ts` | Roteia `voice:boost` e reseta o store |
| `frontend/src/renderer/src/components/level/useMyBoost.ts` (novo) | Hook: percentual do buff da call atual |
| `frontend/src/renderer/src/components/level/StyleRank.tsx` (novo) | Letra + texto + multiplicador |
| `frontend/src/renderer/src/components/level/BoostBanner.tsx` (novo) | Banner/animação de ativação |
| `frontend/src/renderer/src/components/level/VoiceXPBar.tsx` | Mostra `StyleRank`, shimmer e brasas na barra |
| `frontend/src/renderer/src/components/call/VoiceChannelView.tsx` | `StyleRank` no cabeçalho + aura SSS |
| `frontend/src/renderer/src/components/AppShell.tsx` | Monta `BoostBanner` |
| `frontend/src/renderer/src/assets/main.css` | Keyframes e classes `boost-*` + reduced-motion |
| `frontend/src/renderer/src/main.tsx` | `__salinhaBoost(percent)` (preview em dev) |

---

### Task 1: Regra do buff no backend (`boostPercent`, `callBoosts`)

**Files:**
- Create: `backend/internal/level/boost.go`
- Create: `backend/internal/level/boost_test.go`

**Interfaces:**
- Consumes: `call.VoiceActivity{UserID, CallID string; ServerID *string}` (`backend/internal/call/voice_activity.go`).
- Produces:
  - `func boostPercent(eligible int) int` → 100, 125, 150, 175 ou 200.
  - `type callBoost struct{ percent, eligible int }`
  - `func callBoosts(active []call.VoiceActivity) map[string]callBoost` (chave = `CallID`; `eligible` = usuários distintos).

- [ ] **Step 1: Escrever os testes que falham**

`backend/internal/level/boost_test.go`:

```go
package level

import (
	"testing"

	"gin-quickstart/backend/internal/call"
)

func TestBoostPercentSteps(t *testing.T) {
	cases := map[int]int{
		0: 100, 1: 100, 2: 100, 3: 100,
		4: 125, 5: 125,
		6: 150, 7: 150,
		8: 175, 9: 175,
		10: 200, 11: 200, 50: 200,
	}
	for eligible, want := range cases {
		if got := boostPercent(eligible); got != want {
			t.Errorf("boostPercent(%d) = %d, want %d", eligible, got, want)
		}
	}
}

func TestCallBoostsGroupsByCallAndCountsDistinctUsers(t *testing.T) {
	active := []call.VoiceActivity{
		{UserID: "a", CallID: "c1"}, {UserID: "b", CallID: "c1"},
		{UserID: "c", CallID: "c1"}, {UserID: "d", CallID: "c1"},
		{UserID: "d", CallID: "c1"}, // duplicada: não conta duas vezes
		{UserID: "x", CallID: "c2"}, {UserID: "y", CallID: "c2"},
	}

	got := callBoosts(active)

	if got["c1"] != (callBoost{percent: 125, eligible: 4}) {
		t.Errorf("c1 = %+v, want 125%% with 4 eligible", got["c1"])
	}
	if got["c2"] != (callBoost{percent: 100, eligible: 2}) {
		t.Errorf("c2 = %+v, want 100%% with 2 eligible", got["c2"])
	}
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && go test ./internal/level/ -run "TestBoostPercentSteps|TestCallBoosts" -v`
Expected: FAIL com `undefined: boostPercent` (erro de compilação).

- [ ] **Step 3: Implementar**

`backend/internal/level/boost.go`:

```go
package level

import "gin-quickstart/backend/internal/call"

// boostPercent é o multiplicador de XP (em %) de uma call com `eligible`
// pessoas ganhando XP: 100 = sem buff. Os degraus seguem o ranking de estilo
// do cliente: A (4–5), S (6–7), SS (8–9), SSS (10+).
func boostPercent(eligible int) int {
	switch {
	case eligible >= 10:
		return 200
	case eligible >= 8:
		return 175
	case eligible >= 6:
		return 150
	case eligible >= 4:
		return 125
	default:
		return 100
	}
}

// callBoost é o buff de uma call neste instante.
type callBoost struct {
	percent  int
	eligible int
}

// callBoosts agrupa quem está elegível por call e devolve o buff de cada uma.
func callBoosts(active []call.VoiceActivity) map[string]callBoost {
	users := make(map[string]map[string]bool)
	for _, a := range active {
		if users[a.CallID] == nil {
			users[a.CallID] = make(map[string]bool)
		}
		users[a.CallID][a.UserID] = true
	}

	boosts := make(map[string]callBoost, len(users))
	for callID, ids := range users {
		boosts[callID] = callBoost{percent: boostPercent(len(ids)), eligible: len(ids)}
	}
	return boosts
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && go test ./internal/level/ -run "TestBoostPercentSteps|TestCallBoosts" -v`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/internal/level/boost.go backend/internal/level/boost_test.go
git commit -m "feat(level): regra do buff de XP por pessoas na call"
```

---

### Task 2: XP multiplicado e evento `voice:boost` no `level.Service`

**Files:**
- Modify: `backend/internal/level/model.go` (adicionar `BoostEvent` no fim)
- Modify: `backend/internal/level/service.go` (`grant`, `Service`, `LevelService`, `tick`, `accrue`, `give`, novo `publishBoosts`)
- Modify: `backend/internal/level/service_test.go` (helper `newTestService`, `fakePublisher`, novos testes)

**Interfaces:**
- Consumes: `boostPercent`, `callBoost`, `callBoosts` (Task 1).
- Produces:
  - `type BoostEvent struct{ CallID string "json:\"call_id\""; Percent int "json:\"percent\""; Eligible int "json:\"eligible\"" }`
  - Evento WS `{"type":"voice:boost","payload":BoostEvent}` em `call:<callID>`.
  - `grant` ganha o campo `percent int`.
  - `accrue(active []call.VoiceActivity, boosts map[string]callBoost, now time.Time) []grant` (assinatura nova).
  - `Service` ganha `lastBoost map[string]int` (calls com buff ativo → último percentual enviado).

- [ ] **Step 1: Atualizar os fakes e escrever os testes que falham**

Em `backend/internal/level/service_test.go`:

1. No `fakePublisher`, guardar os payloads de `voice:boost`. Substituir a struct e o método `record`:

```go
type fakePublisher struct {
	mu     sync.Mutex
	sent   []string // "<alvo> <tipo>"
	boosts []BoostEvent
}

func (f *fakePublisher) record(target string, raw []byte) {
	var event struct {
		Type    string          `json:"type"`
		Payload json.RawMessage `json:"payload"`
	}
	_ = json.Unmarshal(raw, &event)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, target+" "+event.Type)
	if event.Type == "voice:boost" {
		var boost BoostEvent
		_ = json.Unmarshal(event.Payload, &boost)
		f.boosts = append(f.boosts, boost)
	}
}
```

2. Em `newTestService`, incluir `lastBoost` no literal do `Service`:

```go
	s := &Service{store: store, publisher: pub, voice: voice, pending: map[string]time.Duration{}, lastBoost: map[string]int{}, lastTick: t0}
```

3. Acrescentar helper e testes ao fim do arquivo:

```go
// usersN devolve n nomes distintos ("u1"…"un").
func usersN(n int) []string {
	names := make([]string, n)
	for i := range names {
		names[i] = "u" + string(rune('a'+i))
	}
	return names
}

func TestBoostMultipliesXP(t *testing.T) {
	cases := []struct {
		users int
		want  int64
	}{
		{3, XPPerMinute},           // sem buff
		{4, XPPerMinute * 125 / 100}, // A
		{6, XPPerMinute * 150 / 100}, // S
		{8, XPPerMinute * 175 / 100}, // SS
		{10, XPPerMinute * 200 / 100}, // SSS
	}
	for _, c := range cases {
		s, store, _, _ := newTestService(usersN(c.users)...)
		run(s, t0, 6) // 60 s = 1 minuto
		for _, name := range usersN(c.users) {
			if store.xp[name] != c.want {
				t.Errorf("%d pessoas: xp de %s = %d, want %d", c.users, name, store.xp[name], c.want)
			}
		}
	}
}

func TestBoostEventOnlyWhenBuffed(t *testing.T) {
	s, _, pub, _ := newTestService(usersN(3)...)
	run(s, t0, 6)

	if len(pub.boosts) != 0 {
		t.Fatalf("call sem buff recebeu voice:boost: %+v", pub.boosts)
	}
}

func TestBoostEventIsHeartbeatWhileBuffed(t *testing.T) {
	s, _, pub, _ := newTestService(usersN(4)...)
	run(s, t0, 3)

	if len(pub.boosts) != 3 {
		t.Fatalf("boosts = %d, want 1 por tick (3)", len(pub.boosts))
	}
	want := BoostEvent{CallID: "call-1", Percent: 125, Eligible: 4}
	for _, got := range pub.boosts {
		if got != want {
			t.Errorf("boost = %+v, want %+v", got, want)
		}
	}
}

func TestBoostEndIsAnnouncedOnce(t *testing.T) {
	s, _, pub, voice := newTestService(usersN(4)...)
	now := run(s, t0, 1)

	voice.active = voice.active[:3] // alguém mutou: sobram 3
	now = run(s, now, 1)
	run(s, now, 2) // sem buff: nada mais é enviado

	last := pub.boosts[len(pub.boosts)-1]
	if len(pub.boosts) != 2 || last.Percent != 100 || last.Eligible != 3 {
		t.Fatalf("boosts = %+v, want buff (125) e depois um único aviso de fim (100, 3 elegíveis)", pub.boosts)
	}
}

func TestBoostEndIsAnnouncedWhenCallDisappears(t *testing.T) {
	s, _, pub, voice := newTestService(usersN(4)...)
	now := run(s, t0, 1)

	voice.active = nil // todo mundo saiu/mutou
	run(s, now, 2)

	last := pub.boosts[len(pub.boosts)-1]
	if len(pub.boosts) != 2 || last != (BoostEvent{CallID: "call-1", Percent: 100}) {
		t.Fatalf("boosts = %+v, want buff e depois um único aviso de fim", pub.boosts)
	}
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && go test ./internal/level/ -v`
Expected: FAIL de compilação (`unknown field lastBoost`, `undefined: BoostEvent`).

- [ ] **Step 3: Implementar**

`backend/internal/level/model.go` — acrescentar no fim:

```go
// BoostEvent diz à chamada qual o buff de XP dela agora. Vai a cada tick
// enquanto há buff (quem entra depois recebe no tick seguinte) e uma última
// vez com Percent 100 quando o buff acaba.
type BoostEvent struct {
	CallID   string `json:"call_id"`
	Percent  int    `json:"percent"`
	Eligible int    `json:"eligible"`
}
```

`backend/internal/level/service.go`:

1. `grant`:

```go
// grant é XP pronto para ser gravado.
type grant struct {
	activity call.VoiceActivity
	minutes  int64
	// percent é o buff da call quando o minuto fechou (100 = sem buff).
	percent int
}
```

2. `Service` ganha o campo (depois de `lastTick`):

```go
	pending  map[string]time.Duration
	lastTick time.Time
	// lastBoost: calls com buff ativo (percentual enviado por último).
	lastBoost map[string]int
```

3. `LevelService` inicializa `lastBoost: make(map[string]int),`.

4. `tick`:

```go
func (s *Service) tick(ctx context.Context, now time.Time) {
	active := s.voice.ActiveVoiceUsers()
	boosts := callBoosts(active)
	for _, g := range s.accrue(active, boosts, now) {
		s.give(ctx, g)
	}
	s.publishBoosts(boosts)
}
```

5. `accrue`: nova assinatura `accrue(active []call.VoiceActivity, boosts map[string]callBoost, now time.Time) []grant` e, onde cria o grant:

```go
		if minutes > 0 {
			percent := 100
			if b, ok := boosts[a.CallID]; ok {
				percent = b.percent
			}
			grants = append(grants, grant{activity: a, minutes: minutes, percent: percent})
		}
```

6. `give`: trocar o cálculo do XP:

```go
	// Inteiros: 10 XP/min a 125% rende 12 (a fração é descartada).
	xp := g.minutes * XPPerMinute * int64(g.percent) / 100
```

7. Novo método (depois de `give`):

```go
// publishBoosts avisa cada call com buff (a cada tick) e, uma única vez, as que
// perderam o buff ou sumiram. Calls que nunca tiveram buff não recebem nada.
func (s *Service) publishBoosts(boosts map[string]callBoost) {
	s.mu.Lock()
	var events []BoostEvent
	for callID, b := range boosts {
		_, wasBoosted := s.lastBoost[callID]
		switch {
		case b.percent > 100:
			s.lastBoost[callID] = b.percent
			events = append(events, BoostEvent{CallID: callID, Percent: b.percent, Eligible: b.eligible})
		case wasBoosted:
			delete(s.lastBoost, callID)
			events = append(events, BoostEvent{CallID: callID, Percent: 100, Eligible: b.eligible})
		}
	}
	for callID := range s.lastBoost {
		if _, stillThere := boosts[callID]; !stillThere {
			delete(s.lastBoost, callID)
			events = append(events, BoostEvent{CallID: callID, Percent: 100})
		}
	}
	s.mu.Unlock()

	for _, e := range events {
		s.publisher.BroadcastToCall(e.CallID, marshalEvent("voice:boost", e))
	}
}
```

Antes de salvar: `cd backend && grep -rn "\.accrue(" --include=*.go .` — o único chamador deve ser `tick`; se houver outro, ajustar a chamada.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && gofmt -l ./internal/level && go vet ./internal/level/ && go test ./internal/level/ -v`
Expected: `gofmt -l` sem saída; todos os testes PASS (os 5 antigos de serviço, os de curva e os novos). Se o `gofmt` listar `service_test.go`, rode `gofmt -w` nele (o alinhamento dos comentários da tabela de casos é ajustado por ele).

- [ ] **Step 5: Commit**

```bash
git add backend/internal/level
git commit -m "feat(level): XP de voz multiplicado pelo buff da call e evento voice:boost"
```

---

### Task 3: Rank do buff no cliente (`lib/boost.ts`)

**Files:**
- Create: `frontend/src/renderer/src/lib/boost.ts`
- Create: `frontend/src/renderer/src/lib/boost.test.ts`

**Interfaces:**
- Produces:
  - `type BoostStage = 1 | 2 | 3 | 4`
  - `interface BoostRank { letter: 'A'|'S'|'SS'|'SSS'; text: string; label: string; stage: BoostStage; color: string; accent: string; durationMs: number; sparks: number; ring: boolean; edgeFlash: boolean; quake: boolean; screenFlash: boolean; glitch: boolean; aura: boolean }`
  - `function boostRank(percent: number): BoostRank | null` (`null` abaixo de 125)
  - `function boostLabel(percent: number): string` (`'x1.25'`, `'x1.5'`, `'x1.75'`, `'x2.0'`)

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/renderer/src/lib/boost.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { boostLabel, boostRank } from './boost'

describe('boostRank', () => {
  it('sem buff abaixo de 125%', () => {
    expect(boostRank(100)).toBeNull()
    expect(boostRank(124)).toBeNull()
    expect(boostRank(0)).toBeNull()
  })

  it('mapeia o percentual para o rank estilo DMC', () => {
    expect(boostRank(125)).toMatchObject({ letter: 'A', text: 'Alright!', stage: 1 })
    expect(boostRank(150)).toMatchObject({ letter: 'S', text: 'Sweet!', stage: 2 })
    expect(boostRank(175)).toMatchObject({ letter: 'SS', text: 'Showtime!', stage: 3 })
    expect(boostRank(200)).toMatchObject({ letter: 'SSS', text: "Smokin' Sexy Style!", stage: 4 })
  })

  it('percentuais acima do teto continuam em SSS', () => {
    expect(boostRank(500)?.letter).toBe('SSS')
  })

  it('a animação só cresce com o rank', () => {
    const ranks = [125, 150, 175, 200].map((p) => boostRank(p)!)
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i].durationMs).toBeGreaterThan(ranks[i - 1].durationMs)
      expect(ranks[i].sparks).toBeGreaterThanOrEqual(ranks[i - 1].sparks)
    }
    expect(ranks.map((r) => r.edgeFlash)).toEqual([false, true, true, true])
    expect(ranks.map((r) => r.ring)).toEqual([false, false, true, true])
    expect(ranks.map((r) => r.screenFlash)).toEqual([false, false, false, true])
    expect(ranks.map((r) => r.quake)).toEqual([false, false, false, true])
    expect(ranks.map((r) => r.glitch)).toEqual([false, false, false, true])
    expect(ranks.map((r) => r.aura)).toEqual([false, false, false, true])
  })
})

describe('boostLabel', () => {
  it('formata o multiplicador', () => {
    expect(boostLabel(125)).toBe('x1.25')
    expect(boostLabel(150)).toBe('x1.5')
    expect(boostLabel(175)).toBe('x1.75')
    expect(boostLabel(200)).toBe('x2.0')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/renderer/src/lib/boost.test.ts`
Expected: FAIL (`Failed to resolve import "./boost"`).

- [ ] **Step 3: Implementar**

`frontend/src/renderer/src/lib/boost.ts`:

```ts
/**
 * Buff de XP de voz por pessoas na call. O backend manda só o percentual
 * (100 = sem buff); aqui ele vira o rank no estilo do ranking de estilo do
 * Devil May Cry (só letra e texto, nada de fonte/logo/arte do jogo) e as
 * flags do que a animação mostra: cada rank soma efeitos ao anterior.
 */
export type BoostStage = 1 | 2 | 3 | 4

export interface BoostRank {
  letter: 'A' | 'S' | 'SS' | 'SSS'
  text: string
  /** "x1.25" */
  label: string
  stage: BoostStage
  /** Cor principal da letra, brilho e faíscas. */
  color: string
  /** Contorno/sombra da letra. */
  accent: string
  /** Quanto o banner de ativação fica na tela. */
  durationMs: number
  /** Faíscas soltas pelo banner. */
  sparks: number
  /** Onda de choque (anel) atrás da letra. */
  ring: boolean
  /** Flash vermelho/dourado nas bordas da janela. */
  edgeFlash: boolean
  /** A janela inteira treme no slam. */
  quake: boolean
  /** Flash de tela cheia. */
  screenFlash: boolean
  /** Glitch periódico na letra. */
  glitch: boolean
  /** Aura pulsante no cabeçalho do canal de voz. */
  aura: boolean
}

const RANKS: Record<BoostStage, Omit<BoostRank, 'label'>> = {
  1: {
    letter: 'A',
    text: 'Alright!',
    stage: 1,
    color: '#ef4444',
    accent: '#7f1d1d',
    durationMs: 1200,
    sparks: 0,
    ring: false,
    edgeFlash: false,
    quake: false,
    screenFlash: false,
    glitch: false,
    aura: false
  },
  2: {
    letter: 'S',
    text: 'Sweet!',
    stage: 2,
    color: '#f87171',
    accent: '#b91c1c',
    durationMs: 1600,
    sparks: 0,
    ring: false,
    edgeFlash: true,
    quake: false,
    screenFlash: false,
    glitch: false,
    aura: false
  },
  3: {
    letter: 'SS',
    text: 'Showtime!',
    stage: 3,
    color: '#fb923c',
    accent: '#b45309',
    durationMs: 2000,
    sparks: 12,
    ring: true,
    edgeFlash: true,
    quake: false,
    screenFlash: false,
    glitch: false,
    aura: false
  },
  4: {
    letter: 'SSS',
    text: "Smokin' Sexy Style!",
    stage: 4,
    color: '#fde047',
    accent: '#b45309',
    durationMs: 2500,
    sparks: 22,
    ring: true,
    edgeFlash: true,
    quake: true,
    screenFlash: true,
    glitch: true,
    aura: true
  }
}

export function boostLabel(percent: number): string {
  const multiplier = percent / 100
  return `x${Number.isInteger(multiplier) ? multiplier.toFixed(1) : multiplier}`
}

/** Rank do buff, ou null quando não há buff (menos de 125%). */
export function boostRank(percent: number): BoostRank | null {
  const stage: BoostStage | 0 =
    percent >= 200 ? 4 : percent >= 175 ? 3 : percent >= 150 ? 2 : percent >= 125 ? 1 : 0
  if (stage === 0) return null
  return { ...RANKS[stage], label: boostLabel(percent) }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/renderer/src/lib/boost.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/renderer/src/lib/boost.ts frontend/src/renderer/src/lib/boost.test.ts
git commit -m "feat(level): rank do buff de XP de voz no cliente"
```

---

### Task 4: `boostStore` e ligação do evento `voice:boost`

**Files:**
- Create: `frontend/src/renderer/src/store/boostStore.ts`
- Create: `frontend/src/renderer/src/store/boostStore.test.ts`
- Modify: `frontend/src/renderer/src/api/ws.ts:8-9` (tipo do evento)
- Modify: `frontend/src/renderer/src/store/chatStore.ts` (roteamento perto da linha 645 e reset perto da 228)

**Interfaces:**
- Consumes: `boostRank` (Task 3); `WsEvent` (`api/ws.ts`).
- Produces:
  - `useBoostStore` com `byCall: Record<string, { percent: number; eligible: number }>`, `celebration: BoostCelebration | null`, `handleWsEvent(event: WsEvent): void`, `previewBoost(callId: string, percent: number): void`, `reset(): void`.
  - `interface BoostCelebration { percent: number; eligible: number; key: number }` (`key` muda a cada ativação/subida, para reiniciar a animação).
  - `BOOST_EXPIRE_MS = 25_000` (exportado).

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/renderer/src/store/boostStore.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { boostRank } from '../lib/boost'
import { BOOST_EXPIRE_MS, useBoostStore } from './boostStore'

const boost = (call_id: string, percent: number, eligible = 4): void =>
  useBoostStore.getState().handleWsEvent({
    type: 'voice:boost',
    payload: { call_id, percent, eligible }
  } as never)

describe('boostStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useBoostStore.getState().reset()
  })
  afterEach(() => vi.useRealTimers())

  it('guarda o buff da call', () => {
    boost('c1', 125, 4)
    expect(useBoostStore.getState().byCall.c1).toEqual({ percent: 125, eligible: 4 })
  })

  it('percent 100 remove o buff', () => {
    boost('c1', 150, 6)
    boost('c1', 100, 3)
    expect(useBoostStore.getState().byCall.c1).toBeUndefined()
  })

  it('ignora eventos ruins', () => {
    useBoostStore.getState().handleWsEvent({ type: 'voice:boost', payload: {} } as never)
    useBoostStore.getState().handleWsEvent({ type: 'level:up', payload: {} } as never)
    expect(useBoostStore.getState().byCall).toEqual({})
    expect(useBoostStore.getState().celebration).toBeNull()
  })

  it('o buff some sozinho sem heartbeat e o heartbeat renova', () => {
    boost('c1', 125)
    vi.advanceTimersByTime(BOOST_EXPIRE_MS - 1)
    expect(useBoostStore.getState().byCall.c1).toBeDefined()
    boost('c1', 125) // heartbeat
    vi.advanceTimersByTime(BOOST_EXPIRE_MS - 1)
    expect(useBoostStore.getState().byCall.c1).toBeDefined()
    vi.advanceTimersByTime(1)
    expect(useBoostStore.getState().byCall.c1).toBeUndefined()
  })

  it('celebra ao ativar e ao subir de rank, dura o tempo do rank e some', () => {
    boost('c1', 125)
    expect(useBoostStore.getState().celebration).toMatchObject({ percent: 125, eligible: 4 })
    const first = useBoostStore.getState().celebration!.key

    vi.advanceTimersByTime(boostRank(125)!.durationMs)
    expect(useBoostStore.getState().celebration).toBeNull()

    boost('c1', 150, 6)
    expect(useBoostStore.getState().celebration).toMatchObject({ percent: 150, eligible: 6 })
    expect(useBoostStore.getState().celebration!.key).toBeGreaterThan(first)
  })

  it('heartbeat no mesmo rank, ou o buff mudando dentro do rank, não celebra de novo', () => {
    boost('c1', 125, 4)
    vi.advanceTimersByTime(boostRank(125)!.durationMs)
    boost('c1', 125, 4) // heartbeat
    boost('c1', 125, 5) // 5 pessoas ainda é A
    expect(useBoostStore.getState().celebration).toBeNull()
  })

  it('descer de rank não celebra', () => {
    boost('c1', 200, 10)
    vi.advanceTimersByTime(boostRank(200)!.durationMs)
    boost('c1', 150, 6)
    expect(useBoostStore.getState().celebration).toBeNull()
    expect(useBoostStore.getState().byCall.c1?.percent).toBe(150)
  })

  it('a prévia (dev) liga o buff e a celebração', () => {
    useBoostStore.getState().previewBoost('c9', 175)
    expect(useBoostStore.getState().byCall.c9?.percent).toBe(175)
    expect(useBoostStore.getState().celebration?.percent).toBe(175)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/renderer/src/store/boostStore.test.ts`
Expected: FAIL (`Failed to resolve import "./boostStore"`).

- [ ] **Step 3: Implementar**

`frontend/src/renderer/src/store/boostStore.ts`:

```ts
import { create } from 'zustand'
import type { WsEvent } from '../api/ws'
import { boostRank } from '../lib/boost'

export interface CallBoost {
  percent: number
  eligible: number
}

export interface BoostCelebration {
  percent: number
  eligible: number
  /** Muda a cada ativação/subida, para reiniciar a animação. */
  key: number
}

interface BoostState {
  /** Buff de XP de cada call (só as que têm). */
  byCall: Record<string, CallBoost>
  /** Banner de ativação tocando agora (só aparece para quem está na call). */
  celebration: BoostCelebration | null
  handleWsEvent: (event: WsEvent) => void
  /** Só em dev: liga um buff falso na call `callId`. */
  previewBoost: (callId: string, percent: number) => void
  reset: () => void
}

/**
 * O backend manda `voice:boost` a cada tick (10 s) enquanto a call tem buff e
 * um último com percent 100 quando acaba. Sem heartbeat por tanto tempo (queda
 * de conexão, evento perdido) o buff é descartado.
 */
export const BOOST_EXPIRE_MS = 25_000

let celebrationSeq = 0
let celebrationTimer: ReturnType<typeof setTimeout> | null = null
const expireTimers = new Map<string, ReturnType<typeof setTimeout>>()

function stageOf(percent: number): number {
  return boostRank(percent)?.stage ?? 0
}

export const useBoostStore = create<BoostState>()((set, get) => {
  const celebrate = (percent: number, eligible: number): void => {
    const rank = boostRank(percent)
    if (!rank) return
    const key = ++celebrationSeq
    if (celebrationTimer) clearTimeout(celebrationTimer)
    set({ celebration: { percent, eligible, key } })
    celebrationTimer = setTimeout(() => {
      if (get().celebration?.key === key) set({ celebration: null })
    }, rank.durationMs)
  }

  const clearCall = (callId: string): void => {
    const timer = expireTimers.get(callId)
    if (timer) clearTimeout(timer)
    expireTimers.delete(callId)
    set((state) => {
      if (!(callId in state.byCall)) return {}
      const byCall = { ...state.byCall }
      delete byCall[callId]
      return { byCall }
    })
  }

  const apply = (callId: string, percent: number, eligible: number): void => {
    const previous = get().byCall[callId]?.percent ?? 100
    if (percent <= 100) {
      clearCall(callId)
      return
    }

    set((state) => ({ byCall: { ...state.byCall, [callId]: { percent, eligible } } }))
    const timer = expireTimers.get(callId)
    if (timer) clearTimeout(timer)
    expireTimers.set(
      callId,
      setTimeout(() => clearCall(callId), BOOST_EXPIRE_MS)
    )

    // Banner só ao ativar ou subir de rank (heartbeat e descer não repetem).
    if (stageOf(percent) > stageOf(previous)) celebrate(percent, eligible)
  }

  return {
    byCall: {},
    celebration: null,

    handleWsEvent: (event) => {
      if (event.type !== 'voice:boost') return
      const p = event.payload as { call_id?: string; percent?: number; eligible?: number }
      if (!p.call_id || typeof p.percent !== 'number') return
      apply(p.call_id, p.percent, p.eligible ?? 0)
    },

    previewBoost: (callId, percent) => {
      if (!Number.isFinite(percent)) return
      apply(callId, Math.floor(percent), 0)
    },

    reset: () => {
      expireTimers.forEach((timer) => clearTimeout(timer))
      expireTimers.clear()
      if (celebrationTimer) clearTimeout(celebrationTimer)
      celebrationTimer = null
      set({ byCall: {}, celebration: null })
    }
  }
})
```

`frontend/src/renderer/src/api/ws.ts` — na união `WsEventType`, depois de `'level:up'`:

```ts
  | 'level:up'
  | 'voice:boost'
```

`frontend/src/renderer/src/store/chatStore.ts`:
- Adicionar `import { useBoostStore } from './boostStore'` ao lado do import de `levelStore` (linha ~46).
- Em `handleWsEvent`, logo depois do bloco `if (event.type.startsWith('level:')) { ... }`:

```ts
    if (event.type === 'voice:boost') {
      useBoostStore.getState().handleWsEvent(event)
      return
    }
```

- Onde hoje está `useLevelStore.getState().reset()` (linha ~228), acrescentar logo abaixo `useBoostStore.getState().reset()`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/renderer/src/store/boostStore.test.ts src/renderer/src/store/levelStore.test.ts && npm run typecheck`
Expected: todos PASS; typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/renderer/src/store/boostStore.ts frontend/src/renderer/src/store/boostStore.test.ts frontend/src/renderer/src/api/ws.ts frontend/src/renderer/src/store/chatStore.ts
git commit -m "feat(level): boostStore recebe o buff de XP da call via voice:boost"
```

---

### Task 5: CSS das animações do buff

**Files:**
- Modify: `frontend/src/renderer/src/assets/main.css` (inserir logo depois do bloco `@media (prefers-reduced-motion: reduce)` do `level-anim`, que termina na linha ~588 com `}` antes do comentário `/* Barra de título própria`)

**Interfaces:**
- Produces (classes/keyframes que as Tasks 6–7 usam):
  - `.boost-letter[data-stage]` — letra do rank (slam de entrada + pulso/glitch por rank). Usa as vars `--boost-color`, `--boost-accent`.
  - `.boost-text` — texto do rank em itálico.
  - `.boost-shine` — brilho que corre na barra de XP (duração via var `--boost-shine-ms`).
  - `.boost-ember` — brasa subindo da barra (vars `--dx`, `--delay`).
  - `.boost-aura` — aura pulsante (inset glow).
  - `.boost-banner` (animação de entrada/saída), `.boost-ring`, `.boost-spark` (vars `--dx`, `--dy`), `.boost-flash`, `.boost-edge`, `body.boost-quake #root` (tremida).
  - `.boost-anim` marca o que o `prefers-reduced-motion` neutraliza; `.boost-motion` o que some por completo.

- [ ] **Step 1: Inserir o CSS**

```css
/* --- Buff de XP de voz (ranks A/S/SS/SSS; ver lib/boost.ts) --- */

/* Letra do rank entra "batendo": grande, encolhe passando do ponto e assenta. */
@keyframes boost-slam {
  0% {
    transform: scale(3.2) skewX(-10deg) rotate(-6deg);
    opacity: 0;
  }
  45% {
    transform: scale(0.88) skewX(-10deg) rotate(1deg);
    opacity: 1;
  }
  65% {
    transform: scale(1.1) skewX(-10deg);
  }
  100% {
    transform: scale(1) skewX(-10deg);
    opacity: 1;
  }
}

@keyframes boost-pulse {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.4);
  }
}

/* SSS: glitch curto de tempos em tempos (usa `translate` para não brigar com o slam). */
@keyframes boost-glitch {
  0%,
  90%,
  100% {
    translate: 0 0;
    filter: none;
  }
  92% {
    translate: -3px 1px;
    filter: hue-rotate(40deg) brightness(1.5);
  }
  95% {
    translate: 3px -1px;
  }
  97% {
    translate: -1px 0;
  }
}

.boost-letter {
  display: inline-block;
  font-weight: 900;
  font-style: italic;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--boost-color);
  -webkit-text-stroke: 1px var(--boost-accent);
  text-shadow:
    2px 2px 0 var(--boost-accent),
    0 0 12px var(--boost-color);
  transform: skewX(-10deg);
  animation: boost-slam 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}

.boost-letter[data-stage='2'] {
  animation:
    boost-slam 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both,
    boost-pulse 1.8s ease-in-out 0.5s infinite;
}

.boost-letter[data-stage='3'] {
  animation:
    boost-slam 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both,
    boost-pulse 1.2s ease-in-out 0.5s infinite;
}

.boost-letter[data-stage='4'] {
  animation:
    boost-slam 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both,
    boost-pulse 0.9s ease-in-out 0.5s infinite,
    boost-glitch 4s steps(1) 1s infinite;
}

/* Cinza quando o XP está pausado (mutado): sem brilho, sem movimento. */
.boost-letter[data-paused='true'] {
  animation: none;
  text-shadow: 1px 1px 0 var(--boost-accent);
}

.boost-text {
  font-style: italic;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--boost-color);
}

/* Brilho que corre pela barra de XP. */
.boost-shine {
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.55), transparent);
  animation: boost-shine-run var(--boost-shine-ms, 1800ms) ease-in-out infinite;
}

@keyframes boost-shine-run {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(320%);
  }
}

/* Brasas subindo da barra (SS e SSS). */
@keyframes boost-ember {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  100% {
    transform: translate(var(--dx), -22px) scale(0);
    opacity: 0;
  }
}

.boost-ember {
  animation: boost-ember 1.6s ease-out var(--delay, 0ms) infinite;
}

/* Aura do cabeçalho do canal de voz (SSS). */
@keyframes boost-aura {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.8;
  }
}

.boost-aura {
  box-shadow: inset 0 0 70px 6px var(--boost-color);
  animation: boost-aura 1.6s ease-in-out infinite;
}

/* Banner de ativação: entra deslizando em diagonal, fica, sai. */
@keyframes boost-banner {
  0% {
    transform: translateX(-110%);
    opacity: 0;
  }
  12% {
    transform: translateX(0);
    opacity: 1;
  }
  86% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    transform: translateX(25%);
    opacity: 0;
  }
}

/* S+: flash nas bordas da janela. */
@keyframes boost-edge {
  0%,
  100% {
    opacity: 0;
  }
  15% {
    opacity: 0.9;
  }
  45% {
    opacity: 0.2;
  }
}

.boost-edge {
  box-shadow: inset 0 0 90px 10px var(--boost-color);
}

/* SS+: onda de choque atrás da letra. */
@keyframes boost-ring {
  0% {
    transform: translate(-50%, -50%) scale(0.2);
    opacity: 0.9;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.6);
    opacity: 0;
  }
}

.boost-ring {
  border: 3px solid var(--boost-color);
  border-radius: 9999px;
}

/* SS+: faíscas estourando do banner. */
@keyframes boost-spark {
  0% {
    transform: translate(-50%, -50%) translate(0, 0) scale(0.6);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0);
    opacity: 0;
  }
}

/* SSS: flash dourado de tela cheia. */
@keyframes boost-flash {
  0% {
    opacity: 0;
  }
  8% {
    opacity: 0.85;
  }
  100% {
    opacity: 0;
  }
}

.boost-flash {
  background: radial-gradient(circle at 50% 30%, #fff7c2, var(--boost-color) 45%, transparent 75%);
}

/* SSS: a janela inteira treme no slam (a classe é posta no <body> pelo banner). */
@keyframes boost-quake {
  0%,
  100% {
    translate: 0 0;
  }
  15% {
    translate: -6px 3px;
  }
  30% {
    translate: 6px -4px;
  }
  45% {
    translate: -4px -3px;
  }
  60% {
    translate: 4px 3px;
  }
  80% {
    translate: -2px 1px;
  }
}

body.boost-quake #root {
  animation: boost-quake 0.5s linear;
}

@media (prefers-reduced-motion: reduce) {
  /* Sem slam/pulso/glitch/tremida/brilho: a letra e o banner ficam parados. */
  .boost-letter,
  .boost-letter[data-stage],
  .boost-shine,
  .boost-ember,
  .boost-aura,
  .boost-anim,
  body.boost-quake #root {
    animation: none !important;
  }
  .boost-motion {
    display: none !important;
  }
}
```

- [ ] **Step 2: Conferir o build do CSS**

Run: `cd frontend && npm run typecheck`
Expected: sem erros (CSS não é checado por tipos; a verificação visual é na Task 8). Rode `npx prettier --check src/renderer/src/assets/main.css` e, se reclamar, `npx prettier --write` no arquivo.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/renderer/src/assets/main.css
git commit -m "feat(level): keyframes e classes das animações do buff de XP"
```

---

### Task 6: `StyleRank` e integração em `VoiceXPBar` e `VoiceChannelView`

**Files:**
- Create: `frontend/src/renderer/src/components/level/useMyBoost.ts`
- Create: `frontend/src/renderer/src/components/level/StyleRank.tsx`
- Modify: `frontend/src/renderer/src/components/level/VoiceXPBar.tsx`
- Modify: `frontend/src/renderer/src/components/call/VoiceChannelView.tsx`

**Interfaces:**
- Consumes: `boostRank`, `BoostRank` (Task 3); `useBoostStore` (Task 4); classes `boost-*` (Task 5); `useCallStore((s) => s.callId)`.
- Produces:
  - `function useMyBoostPercent(): number` — buff da call atual (100 se não há).
  - `function StyleRank(props: { percent: number; paused?: boolean; size?: 'sm' | 'md'; className?: string }): React.JSX.Element | null` — `null` sem buff.

- [ ] **Step 1: Hook**

`frontend/src/renderer/src/components/level/useMyBoost.ts`:

```ts
import { useBoostStore } from '../../store/boostStore'
import { useCallStore } from '../../store/callStore'

/** Percentual do buff de XP da call em que você está (100 = sem buff). */
export function useMyBoostPercent(): number {
  const callId = useCallStore((s) => s.callId)
  return useBoostStore((s) => (callId ? s.byCall[callId]?.percent : undefined) ?? 100)
}
```

- [ ] **Step 2: `StyleRank`**

`frontend/src/renderer/src/components/level/StyleRank.tsx`:

```tsx
import { boostRank } from '../../lib/boost'

interface StyleRankProps {
  percent: number
  /** XP pausado (mutado/surdo): rank apagado em cinza. */
  paused?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Letra do rank do buff de XP (A/S/SS/SSS), o texto ("Sweet!") e o
 * multiplicador. Não renderiza nada sem buff. Trocar de rank remonta a letra
 * (a `key`), o que dispara de novo o slam.
 */
function StyleRank({
  percent,
  paused = false,
  size = 'sm',
  className = ''
}: StyleRankProps): React.JSX.Element | null {
  const rank = boostRank(percent)
  if (!rank) return null

  const vars = {
    '--boost-color': paused ? '#6b7280' : rank.color,
    '--boost-accent': paused ? '#374151' : rank.accent
  } as React.CSSProperties

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      style={vars}
      title={`Buff de XP ${rank.label} (${rank.text})`}
    >
      <span
        key={rank.letter}
        className={`boost-letter ${size === 'md' ? 'text-3xl' : 'text-xl'}`}
        data-stage={rank.stage}
        data-paused={paused}
      >
        {rank.letter}
      </span>
      <span className="flex flex-col leading-none">
        <span className={`boost-text ${size === 'md' ? 'text-xs' : 'text-[10px]'}`}>
          {rank.text}
        </span>
        <span className={`font-bold text-gray-300 ${size === 'md' ? 'text-[11px]' : 'text-[9px]'}`}>
          XP {rank.label}
        </span>
      </span>
    </span>
  )
}

export default StyleRank
```

- [ ] **Step 3: `VoiceXPBar`**

Em `frontend/src/renderer/src/components/level/VoiceXPBar.tsx`:

1. Imports (topo):

```tsx
import { boostRank } from '../../lib/boost'
import StyleRank from './StyleRank'
import { useMyBoostPercent } from './useMyBoost'
```

2. O hook precisa rodar antes do `return null`. Mudar o começo do componente para:

```tsx
function VoiceXPBar({ paused }: { paused: boolean }): React.JSX.Element | null {
  const me = useLevelStore((s) => s.me)
  const boostPercent = useMyBoostPercent()
  if (!me) return null

  const rank = boostRank(boostPercent)
```

3. Mostrar o rank acima da barra (logo depois da `<div ... title=...>` de abertura e antes do bloco `mb-1 flex ...`):

```tsx
      {rank && <StyleRank percent={boostPercent} paused={paused} className="mb-1" />}
```

4. Dentro da barra (`h-1.5 overflow-hidden rounded-full bg-white/10`), depois do `div` do preenchimento, acrescentar o shimmer — e permitir que as brasas apareçam fora dela envolvendo-a em um `relative`. Substituir o bloco da barra por:

```tsx
      <div className="relative">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="relative h-full overflow-hidden rounded-full transition-[width] duration-700"
            style={{
              width: `${percent}%`,
              backgroundImage: paused
                ? 'linear-gradient(90deg, #4b5563, #374151)'
                : `linear-gradient(90deg, ${tier.accent}, ${tier.color})`,
              boxShadow: paused ? undefined : `0 0 8px ${tier.color}88`
            }}
          >
            {rank && !paused && (
              <span
                aria-hidden="true"
                className="boost-shine boost-motion absolute inset-y-0 w-1/4"
                style={
                  { '--boost-shine-ms': `${2400 - rank.stage * 400}ms` } as React.CSSProperties
                }
              />
            )}
          </div>
        </div>
        {rank && rank.stage >= 3 && !paused &&
          Array.from({ length: rank.stage === 3 ? 4 : 7 }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="boost-ember boost-motion pointer-events-none absolute -top-0.5 h-[3px] w-[3px] rounded-full"
              style={
                {
                  left: `${10 + ((i * 53) % 80)}%`,
                  background: rank.color,
                  boxShadow: `0 0 4px ${rank.color}`,
                  '--dx': `${(i % 2 === 0 ? 1 : -1) * (3 + ((i * 7) % 8))}px`,
                  '--delay': `${i * 230}ms`
                } as React.CSSProperties
              }
            />
          ))}
      </div>
```

(O `div` do preenchimento ganhou `relative overflow-hidden` para conter o brilho; o restante do arquivo — texto "Nível"/XP — não muda. Rode `npx prettier --write` no arquivo ao fim.)

- [ ] **Step 4: `VoiceChannelView`**

Em `frontend/src/renderer/src/components/call/VoiceChannelView.tsx`:

1. Imports:

```tsx
import { boostRank } from '../../lib/boost'
import StyleRank from '../level/StyleRank'
import { useMyBoostPercent } from '../level/useMyBoost'
```

2. Dentro do componente, junto dos outros hooks (antes do `return`):

```tsx
  const boostPercent = useMyBoostPercent()
  const rank = connectedHere ? boostRank(boostPercent) : null
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)
```

3. Aura no container raiz: logo dentro do `div className="relative flex flex-1 flex-col overflow-hidden"`, antes do bloco `{connectedHere && (` do cabeçalho:

```tsx
      {rank?.aura && !(muted || deafened) && (
        <span
          aria-hidden="true"
          className="boost-aura boost-motion pointer-events-none absolute inset-0 z-0"
          style={{ '--boost-color': `${rank.color}66` } as React.CSSProperties}
        />
      )}
```

4. Rank no cabeçalho: dentro do bloco `{connectedHere && ( <div className="absolute right-4 top-3 ...">` não cabe (é uma pílula verde). Acrescentar, logo depois dessa pílula e ainda dentro do `connectedHere`, um segundo elemento à esquerda dela:

```tsx
      {connectedHere && rank && (
        <div className="absolute left-4 top-3 z-10 rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur">
          <StyleRank percent={boostPercent} paused={muted || deafened} size="md" />
        </div>
      )}
```

- [ ] **Step 5: Typecheck e lint**

Run: `cd frontend && npm run typecheck && npx eslint src/renderer/src/components/level src/renderer/src/components/call/VoiceChannelView.tsx && npx prettier --check src/renderer/src/components/level src/renderer/src/components/call/VoiceChannelView.tsx`
Expected: sem erros. Se o prettier reclamar, `npx prettier --write` nos mesmos arquivos.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/renderer/src/components/level frontend/src/renderer/src/components/call/VoiceChannelView.tsx
git commit -m "feat(level): StyleRank na barra de XP e no cabeçalho do canal de voz"
```

---

### Task 7: `BoostBanner` (animação de ativação) e preview em dev

**Files:**
- Create: `frontend/src/renderer/src/components/level/BoostBanner.tsx`
- Modify: `frontend/src/renderer/src/components/AppShell.tsx` (importar e montar depois de `<LevelUpBanner />`)
- Modify: `frontend/src/renderer/src/main.tsx` (preview em dev)

**Interfaces:**
- Consumes: `useBoostStore().celebration` (Task 4), `boostRank` (Task 3), classes `boost-*` (Task 5).
- Produces: `BoostBanner` (default export, sem props).

- [ ] **Step 1: Banner**

`frontend/src/renderer/src/components/level/BoostBanner.tsx`:

```tsx
import { useEffect, useMemo } from 'react'
import { boostRank } from '../../lib/boost'
import { useBoostStore } from '../../store/boostStore'

/**
 * Banner de ativação do buff de XP (quando a call ganha buff ou sobe de rank).
 * A festa cresce com o rank (lib/boost.ts): A só desliza a letra; S pisca as
 * bordas; SS solta onda de choque e faíscas; SSS também faz flash dourado de
 * tela cheia, treme a janela e deixa a letra com glitch.
 */
function BoostBanner(): React.JSX.Element | null {
  const celebration = useBoostStore((s) => s.celebration)
  const rank = celebration ? boostRank(celebration.percent) : null

  // SSS: a janela treme uma vez no slam.
  const quake = rank?.quake ?? false
  const key = celebration?.key
  useEffect(() => {
    if (key === undefined || !quake) return
    document.body.classList.add('boost-quake')
    const timer = setTimeout(() => document.body.classList.remove('boost-quake'), 600)
    return () => {
      clearTimeout(timer)
      document.body.classList.remove('boost-quake')
    }
  }, [key, quake])

  const sparks = useMemo(() => {
    if (!rank) return []
    return Array.from({ length: rank.sparks }, (_, i) => {
      const angle = ((i / Math.max(1, rank.sparks)) * 360 + (i % 2) * 11) * (Math.PI / 180)
      const reach = 70 + ((i * 37) % 70)
      return {
        dx: Math.cos(angle) * reach,
        dy: Math.sin(angle) * reach * 0.6,
        size: 3 + (i % 3),
        delay: 120 + (i % 5) * 40
      }
    })
  }, [rank])

  if (!celebration || !rank) return null

  const vars = {
    '--boost-color': rank.color,
    '--boost-accent': rank.accent
  } as React.CSSProperties

  return (
    <div
      key={celebration.key}
      role="status"
      aria-label={`Buff de XP ${rank.label}: ${rank.text}`}
      className="pointer-events-none fixed inset-0 z-50"
      style={vars}
    >
      {rank.screenFlash && (
        <span
          aria-hidden="true"
          className="boost-flash boost-motion absolute inset-0"
          style={{ animation: `boost-flash ${rank.durationMs}ms ease-out both` }}
        />
      )}
      {rank.edgeFlash && (
        <span
          aria-hidden="true"
          className="boost-edge boost-motion absolute inset-0"
          style={{ animation: `boost-edge ${Math.min(1400, rank.durationMs)}ms ease-out both` }}
        />
      )}

      <div
        className="boost-anim absolute left-0 top-[calc(var(--titlebar-height,0px)+5rem)]"
        style={{ animation: `boost-banner ${rank.durationMs}ms ease-in-out both` }}
      >
        <div
          className="relative flex items-center gap-4 py-2 pl-6 pr-12"
          style={{
            background: `linear-gradient(90deg, ${rank.accent}f2, #0b0b10f2 70%)`,
            borderBottom: `3px solid ${rank.color}`,
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%)',
            boxShadow: `0 0 30px ${rank.color}88`
          }}
        >
          <span className="relative flex items-center justify-center">
            {rank.ring && (
              <span
                aria-hidden="true"
                className="boost-ring boost-motion absolute left-1/2 top-1/2 h-16 w-16"
                style={{ animation: 'boost-ring 0.9s ease-out 0.25s both' }}
              />
            )}
            <span className="boost-letter text-6xl" data-stage={rank.stage}>
              {rank.letter}
            </span>
          </span>

          <div className="leading-tight">
            <p className="boost-text text-lg">{rank.text}</p>
            <p className="text-xs font-bold text-gray-200">
              XP {rank.label}
              {celebration.eligible > 0 && ` · ${celebration.eligible} pessoas`}
            </p>
          </div>

          {sparks.map((spark, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="boost-motion absolute left-14 top-1/2 rounded-full"
              style={
                {
                  '--dx': `${spark.dx}px`,
                  '--dy': `${spark.dy}px`,
                  width: spark.size,
                  height: spark.size,
                  background: i % 2 === 0 ? rank.color : '#ffffff',
                  boxShadow: `0 0 6px ${rank.color}`,
                  animation: `boost-spark 1s ease-out ${spark.delay}ms both`
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default BoostBanner
```

- [ ] **Step 2: Montar no `AppShell`**

Em `frontend/src/renderer/src/components/AppShell.tsx`: `import BoostBanner from './level/BoostBanner'` junto dos imports de `level/` e, no JSX, acrescentar `<BoostBanner />` logo depois de `<LevelUpBanner />`.

- [ ] **Step 3: Preview em dev**

Em `frontend/src/renderer/src/main.tsx`: importar `useBoostStore` e `useCallStore` e estender o bloco de dev:

```tsx
import { useBoostStore } from './store/boostStore'
import { useCallStore } from './store/callStore'

// Dev: `__salinhaLevelUp(85)` no console toca a animação de subir de nível;
// `__salinhaBoost(175)` liga um buff de XP falso (125/150/175/200) na sua call.
if (import.meta.env.DEV) {
  const dev = window as unknown as {
    __salinhaLevelUp: (level: number) => void
    __salinhaBoost: (percent: number) => void
  }
  dev.__salinhaLevelUp = (level) => useLevelStore.getState().previewLevelUp(level)
  dev.__salinhaBoost = (percent) =>
    useBoostStore.getState().previewBoost(useCallStore.getState().callId ?? 'preview', percent)
}
```

(substitui o bloco `if (import.meta.env.DEV)` existente; o preview some em 25 s, igual a um buff sem heartbeat.)

- [ ] **Step 4: Typecheck, lint, testes**

Run: `cd frontend && npm run typecheck && npx eslint src/renderer/src && npx prettier --check src/renderer/src && npm test`
Expected: tudo verde. `prettier --write` nos arquivos novos se necessário.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/renderer/src/components/level/BoostBanner.tsx frontend/src/renderer/src/components/AppShell.tsx frontend/src/renderer/src/main.tsx
git commit -m "feat(level): banner de ativação do buff de XP com animação por rank"
```

---

### Task 8: Verificação final

**Files:** nenhum novo (só correções que a verificação apontar).

- [ ] **Step 1: Suítes completas**

Run:
```bash
cd backend && gofmt -l . && go vet ./... && go test ./...
cd ../frontend && npm run typecheck && npm run lint && npm test
```
Expected: `gofmt -l` sem saída; vet/test/typecheck/lint/vitest verdes.

- [ ] **Step 2: Conferência visual dos 4 ranks**

Subir o frontend em dev (`cd frontend && npm run dev:web`; lembrar do workaround do `postcss.config.mjs` perdido em `C:\Users\Admin`, ver memória `concord-dev-env`), entrar em um canal de voz e, no console, rodar `__salinhaBoost(125)`, `150`, `175`, `200`. Conferir:
- A: letra bate e fica; barra com brilho suave.
- S: borda vermelha pisca; brilho mais rápido; letra pulsa.
- SS: onda de choque + faíscas; brasas sobem da barra.
- SSS: flash dourado de tela cheia, janela treme, glitch na letra, aura dourada no cabeçalho do canal.
- Mutar o microfone: rank fica cinza, sem brilho/brasas/aura.
- Ativar "reduzir movimento" no SO (ou emular `prefers-reduced-motion` nas DevTools): tudo parado, banner estático, sem partículas.
- Esperar 25 s sem novo comando: o buff some.

- [ ] **Step 3: Teste ponta a ponta com o backend**

Com o backend rodando, 4 contas em um mesmo canal de voz sem mute: o rank A aparece para todos em até 10 s e o XP por minuto vira 12. Mutar uma conta (sobram 3): o buff some nas outras em até 10 s.

- [ ] **Step 4: Commit de eventuais correções**

```bash
git add -A
git commit -m "fix(level): ajustes da verificação do buff de XP de voz"
```

(Pular se não houve correção.)

---

## Self-review (feita ao escrever)

- **Cobertura do spec:** regra e tabela (Task 1), contagem por call só de elegíveis (Task 1 + `ActiveVoiceUsers` já filtra), XP inteiro multiplicado no instante do minuto (Task 2), evento com heartbeat + fim único + sem evento sem buff (Task 2), expiração de 25 s no cliente (Task 4), `boostRank` com letra/texto/rótulo/paleta/efeitos (Task 3), `StyleRank` em `VoiceXPBar` e cabeçalho, cinza quando mutado, shimmer e brasas (Task 6), banner por rank com slam, onda de choque, faíscas, flash, tremida, glitch e aura (Tasks 5–7), banner só ao ativar/subir (Task 4), reduced-motion (Task 5), testes Go e frontend (Tasks 1–4), preview em dev (Tasks 4 e 7).
- **Consistência de nomes:** `boostPercent`/`callBoosts`/`callBoost`/`BoostEvent`/`lastBoost`/`publishBoosts` (Go); `boostRank`/`boostLabel`/`BoostRank`/`useBoostStore`/`BOOST_EXPIRE_MS`/`useMyBoostPercent`/`StyleRank`/`BoostBanner` (TS) usados de forma idêntica em todas as tasks.
- **Fora de escopo mantido:** sem som, sem perfil/ranking, sem persistência.
