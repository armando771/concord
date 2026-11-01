# God files e god services

Um arquivo, serviço, store ou componente que faz mais de uma coisa. É o
principal motivo de código gerado por IA ficar difícil de manter: o agente
sempre acha mais fácil "só adicionar mais um método" no arquivo que já está
aberto.

## Como reconhecer

Qualquer um destes sinais já basta:

- mais de **400 linhas** (o `scripts/check-structure.mjs` usa esse limite);
- mais de **7 dependências** injetadas no construtor ou no `struct`;
- o nome é genérico (`service`, `manager`, `utils`, `helpers`, `Store` de tudo) e
  descrever o que ele faz exige "e": "cuida das chamadas **e** do soundboard **e**
  da tela compartilhada";
- métodos que não usam os mesmos campos (grupos que nunca se tocam = classes
  diferentes esperando para nascer);
- o teste precisa montar um mundo inteiro para testar uma regra pequena.

## A regra do repo

Tocou num arquivo com esses sinais? **No mesmo PR**, extraia a responsabilidade
que você está alterando para uma unidade própria. A catraca do
`check-structure` exige que um arquivo com mais de 400 linhas saia do PR
**menor** do que entrou. Não precisa refatorar o arquivo inteiro: só o pedaço
que você tocou, para que cada mudança deixe o código um pouco melhor.

Commits separados: primeiro o estrutural (extrai, testes verdes, nenhum
comportamento muda), depois a mudança de comportamento.

## Go: ruim

```go
// internal/call/service.go: o serviço de chamadas virou o lugar de tudo.
type Service struct {
	repository   *Repository
	publisher    EventPublisher
	conversation *conversation.Service
	servers      *server.Service
	channels     *channel.Service
	users        *user.Service
	sounds       SoundLookup
	perms        *permission.Service
	media        MediaAdmin
	// ... mais 10 campos
}

func (s *Service) Join(...)             // ciclo de vida da chamada
func (s *Service) PlaySound(...)        // soundboard
func (s *Service) StartScreenShare(...) // tela compartilhada
func (s *Service) DrawOnScreen(...)     // anotação na tela
func (s *Service) HandleCallMessage(ctx context.Context, msg Message) error {
	switch msg.Type { // 60+ cases: complexidade 69, CRAP > 3800
	case "call:invite":
		// 40 linhas
	case "call:screen:draw":
		// 30 linhas
		// ...
	}
}
```

## Go: bom

```go
// internal/call/screen_draw.go: uma responsabilidade, dependências mínimas.
type ScreenDraw struct {
	calls     CallLookup     // interface pequena, definida aqui (quem consome)
	publisher EventPublisher
}

func (d *ScreenDraw) Draw(ctx context.Context, callID, userID string, stroke Stroke) error {
	if !d.calls.IsSharing(callID, userID) {
		return ErrNotSharing
	}
	return d.publisher.BroadcastToCall(callID, "call:screen:draw", stroke)
}

// internal/call/router.go: o switch vira um mapa de handlers pequenos.
var handlers = map[string]func(*Service, context.Context, Message) error{
	"call:invite":      (*Service).handleInvite,
	"call:screen:draw": (*Service).handleScreenDraw,
}

func (s *Service) HandleCallMessage(ctx context.Context, msg Message) error {
	h, ok := handlers[msg.Type]
	if !ok {
		return ErrUnknownMessage
	}
	return h(s, ctx, msg)
}
```

O que mudou: cada arquivo tem um motivo para mudar, as interfaces são
declaradas por quem consome (com 1–3 métodos) e o roteamento não tem
complexidade que cresce a cada mensagem nova.

## TS/React: ruim

```ts
// features/call/store/callStore.ts: 2000 linhas, um store para tudo da chamada.
export const useCallStore = create<CallState>((set, get) => ({
  participants: [],
  screenShares: [],
  soundboardVolume: 1,
  annotations: [],
  noiseSuppression: true,
  join: async (callId) => { /* 120 linhas: LiveKit, permissões, toasts, áudio */ },
  playSound: (id) => { /* ... */ },
  draw: (stroke) => { /* ... */ },
  // ... 80 ações
}))
```

```tsx
// Componente que busca dados, guarda estado, formata e desenha tudo.
export function ChatPane() {
  // 30 useState, 15 useEffect, 1300 linhas de JSX com ternários aninhados
}
```

## TS/React: bom

```ts
// features/call/store/screenShareStore.ts: um store por responsabilidade.
export const useScreenShareStore = create<ScreenShareState>((set) => ({
  shares: [],
  add: (share) => set((s) => ({ shares: [...s.shares, share] })),
  remove: (id) => set((s) => ({ shares: s.shares.filter((x) => x.id !== id) }))
}))

// features/call/lib/screenShare.ts: regra pura, testável sem React nem LiveKit.
export function canWatch(share: ScreenShare, me: string, perms: Perms): boolean {
  return share.ownerId !== me && perms.has(Permission.ViewChannel)
}
```

```tsx
// Container fino + componentes de apresentação.
export function ChatPane({ channelId }: Props) {
  const messages = useChannelMessages(channelId) // hook: dados
  return (
    <ChatLayout header={<ChatHeader channelId={channelId} />} composer={<Composer channelId={channelId} />}>
      <MessageList messages={messages} />
    </ChatLayout>
  )
}
```

Para componentes com muitas props booleanas (`isCompact`, `showHeader`,
`isThread`...), veja a skill
[composition-patterns](../../../.claude/skills/composition-patterns/SKILL.md).
