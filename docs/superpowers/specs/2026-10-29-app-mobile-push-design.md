# App mobile, fatia 2c: notificações push (backend + app), prontas para ligar

Última fatia do Chat ([roadmap](2026-10-27-app-mobile-roadmap-design.md)). Depende do #385. Decisão de
arquitetura: [ADR 0022](../../adr/0022-push-direto-pelo-fcm.md) (FCM direto, sem conta Expo).

## Objetivo

Quando o app não está aberto, avisar no celular: **DMs**, **@menções** e **pedidos de amizade**. Tocar na
notificação abre a conversa, o canal ou a tela de Amigos. Tudo fica pronto e testado; o push **liga
sozinho** quando o dono colocar as credenciais do Firebase (que ainda não existem). Sem elas, o backend
e o app funcionam normalmente, só sem push.

## Decisões (com o porquê)

- **Envio direto pelo FCM HTTP v1** com a conta de serviço do Firebase; JWT assinado com a lib padrão do
  Go, sem dependência nova (ADR 0022). No app, `expo-notifications` com o token nativo
  (`getDevicePushTokenAsync`): sem conta Expo.
- **Desligado sem credenciais**: backend sem `FCM_SERVICE_ACCOUNT_FILE` não envia (um log na subida) e
  o APK sem `google-services.json` não registra token (sem erro na tela). Nada quebra antes da hora.
- **Só notifica quem não está com o app aberto** (`Hub.IsOnline` falso) e **não está em Não perturbar**
  (`EffectiveStatus`). Respeita servidor/canal silenciado e o nível do `notifysettings`
  (`nothing` nunca, `mentions` só menções).
- **Eventos**: DM (e grupo) de outra pessoa; menção em canal (@usuário, @everyone/@here conforme
  `mention_everyone`); pedido de amizade recebido. Mensagem comum de canal não notifica.
- **Ponto de entrada sem mexer na regra de mensagem**: `internal/push` decora o `EventPublisher` da
  mensagem e o publicador de amizade (delega ao Hub e depois decide a notificação).
- **Foreground**: com o app aberto não mostra banner (os selos e o chat já avisam).
- **Token é por aparelho**: `PUT /api/push/token` ao entrar, `DELETE` ao sair; o FCM devolvendo
  "não registrado" apaga o token no servidor.

## Arquitetura (arquivos e pastas)

```
backend/
  migrations/000171_create_push_tokens.up.sql / .down.sql     (user_id, token único, platform, updated_at)
  internal/platform/fcm/
    client.go          JWT (crypto/rsa) → token OAuth2 (cache) → messages:send; ErrUnregistered; Disabled
    config.go          FCM_SERVICE_ACCOUNT_FILE|JSON, FCM_ENDPOINT e FCM_TOKEN_URL (para teste com servidor falso)
  internal/push/
    model.go repository.go   tokens por usuário (upsert, remover por token ou usuário)
    service.go handler.go routes.go   PUT/DELETE /api/push/token
    notifier.go        decide quem notifica e monta o texto/dados (regras acima)
    publisher.go       decorador do message.EventPublisher e do publicador de amizade
  cmd/wire_push.go     monta tudo e registra rotas; não engorda o main.go
mobile/
  app.config.ts        plugin expo-notifications; googleServicesFile só se GOOGLE_SERVICES_JSON existir
  src/features/notifications/
    api/push.ts                registerToken, unregisterToken
    lib/notificationRoute.ts   dados da notificação → rota do app
    lib/pushRegistration.ts    regras: pedir permissão, quando registrar e desregistrar
    hooks/usePushRegistration.ts   permissão, token nativo, PUT/DELETE, renovação do token
    hooks/useNotificationTap.ts    toque (app aberto ou fechado) → abre a tela certa
docs/PUSH.md           passo a passo para o dono criar o Firebase e ligar (variáveis, build)
```

Estrutura por feature como o desktop; sem arquivo solto. `docs/PUSH.md` + ADR 0022 fecham a documentação.

## Fluxo de dados

1. **Registrar**: logado, o app pede a permissão (Android 13+ `POST_NOTIFICATIONS`), pega o token do FCM e
   faz `PUT /api/push/token {token, platform: "android"}`. Token novo (renovação) repete o PUT. Sair da
   conta faz `DELETE`. Sem `google-services.json` ou sem permissão, não faz nada.
2. **Evento**: mensagem nova ou pedido de amizade passam pelo decorador. Para cada destinatário
   candidato: sem WebSocket aberto, fora do Não perturbar, não silenciou, nível permite → monta a
   mensagem e envia a cada token dele.
3. **Envio**: `fcm.Send` com prioridade alta e canal Android "mensagens"; resposta "não registrado" →
   remove o token; erro de rede é só registrado em log (não atrasa nem derruba a entrega da mensagem:
   o envio roda fora do caminho da requisição).
4. **Toque**: `data` leva `type` (`dm`, `mention` ou `friend_request`) e os ids; `notificationRoute`
   transforma em `/dm/<id>`, `/canal/<id>` ou `/amigos`. App fechado: `getLastNotificationResponseAsync`.

## Erros

Falha do FCM, do token OAuth2 ou conta de serviço inválida: log claro, push desligado até corrigir; nunca
afeta mensagens. Permissão negada: o app não insiste (um pedido por entrada) e funciona normal.

## Textos (para aprovação do dono)

Montados no servidor (o app só exibe):

- DM: título = nome de quem mandou; texto = começo da mensagem (até ~100 caracteres). Grupo: título
  "Nome de quem mandou · nome do grupo".
- Menção em canal: título "{autor} em #{canal}"; texto = começo da mensagem.
- Pedido de amizade: título "Novo pedido de amizade"; texto "{nome} quer ser seu amigo".
- Mensagem só com anexo: texto "Enviou um anexo".
- Canal de notificação do Android: nome "Mensagens".

## Testes (TDD, só o que importa)

- **Go**: `fcm` (JWT válido assinado, troca de token e cache, envio, "não registrado", desligado sem
  credenciais, com `httptest`); `push` repositório (upsert, remover), handler (autenticação, validação),
  `notifier` em tabela (online não notifica, Não perturbar, silenciado, nível `mentions`/`nothing`, autor
  nunca se notifica, menção em canal, pedido de amizade, token inválido removido); decorador delega ao Hub
  mesmo se o push falhar. CRAP ≤ 15.
- **App**: `notificationRoute`, `pushRegistration`, `usePushRegistration` (permissão negada, sem token,
  renovação, logout), `useNotificationTap`.

## Fora de escopo

iOS; mensagens comuns de canal e agrupamento; responder pela notificação; som e vibração por canal;
selo no ícone do app; push de voz/chamada.

## Verificação de ponta a ponta

1. `node scripts/affected-tests.mjs pr` verde (Go e mobile).
2. **Sem Firebase** (o que dá para provar agora): backend com `FCM_ENDPOINT`/`FCM_TOKEN_URL` apontando
   para um servidor falso e conta de serviço de teste; emulador registra um token; mandar DM com o app
   fechado → o servidor falso recebe o POST com título, texto e `data` certos; app aberto, silenciado e
   Não perturbar → nada chega; token "não registrado" → removido.
3. **Com Firebase** (só depois que o dono criar o projeto, seguindo `docs/PUSH.md`): notificação real no
   emulador/aparelho; fica registrado na spec como **não verificado** até lá.
