# 0022. Enviar o push do app mobile direto pelo FCM, com o JWT da biblioteca padrão

- Status: proposto
- Data: 2026-10-29

## Contexto

O app Android precisa avisar DMs, @menções e pedidos de amizade quando não está aberto. O app é
construído localmente (sem EAS nem conta Expo, [ADR 0021](0021-app-mobile-expo.md)) e a conta do
Firebase do dono ainda não existe: o código precisa ficar pronto e ligar sozinho quando as
credenciais forem colocadas. O backend já sabe quem está conectado (`Hub.IsOnline`), o status
(Não perturbar) e as preferências de silêncio (`notifysettings`).

## Opções consideradas

1. **FCM HTTP v1 direto, JWT da conta de serviço assinado com a lib padrão (`crypto/rsa`).** O app
   pega o token nativo (`getDevicePushTokenAsync`), o backend troca o JWT por um token OAuth2 e
   chama `fcm.googleapis.com/v1/projects/<id>/messages:send`. Prós: sem conta Expo e sem
   dependência nova no `go.mod`; tudo testável com `httptest`. Contras: ~100 linhas nossas para o
   JWT e o cache do token.
2. **SDK oficial (`firebase-admin-go`).** Menos código, mas puxa dezenas de dependências para o
   `go.mod` só para um POST.
3. **Expo Push Service.** O Expo documenta enviar por conta própria com o token nativo, e o serviço
   deles exige subir a chave do Firebase numa conta Expo, o que foge da decisão de build local.

## Decisão

Opção 1. O pacote `internal/platform/fcm` fala com o FCM e fica desligado sem as variáveis de
ambiente (o backend e o app funcionam normalmente, só sem push). O domínio `internal/push`
guarda os tokens dos aparelhos e decide quem notifica, como decorador do `EventPublisher` da
mensagem, sem mexer no `message/service.go`.

## Consequências

- Mais fácil: ligar o push é só colocar `FCM_SERVICE_ACCOUNT_FILE` (backend) e o
  `google-services.json` (build do APK); testar sem Firebase, apontando `FCM_ENDPOINT` e
  `FCM_TOKEN_URL` para um servidor falso.
- Mais difícil: manter o JWT/OAuth2 nosso se o Google mudar o fluxo (improvável, é o padrão
  documentado). iOS fica de fora (só Android, como o roadmap).
- Depois: mensagens de canal comuns, agrupamento e resposta rápida pela notificação.

## Fontes

- [Expo: enviar notificações com servidor próprio](https://docs.expo.dev/push-notifications/sending-notifications-custom/)
- [Firebase: autorizar pedidos no servidor](https://firebase.google.cn/docs/cloud-messaging/auth-server?hl=en)
- [Firebase: enviar mensagem pela API HTTP v1](https://firebase.google.cn/docs/cloud-messaging/send/v1-api)
