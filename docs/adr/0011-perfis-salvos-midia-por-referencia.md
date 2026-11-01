# 0011. Guardar perfis salvos com a mídia por referência, apagando o arquivo só quando ninguém mais usa

- Status: aceito
- Data: 2026-10-28

## Contexto

Issue #344: a pessoa monta o perfil (avatar, banner, cor do banner, nome e
estilo, pronomes, nota, Sobre mim, links, tema do cartão) e quer guardar esse
estado com um nome para trocar rápido entre vários. Hoje cada arquivo de
avatar/banner tem dono único: trocar ou remover apaga o anterior do disco
(`user.ProfileHandler.removeMedia`). Se o perfil salvo guardar só a URL, a
próxima troca de avatar apaga a imagem que ele usa; se copiar o arquivo, cada
perfil salvo duplica até 20 MB (imagem + quadro parado) no servidor.

Forças: não duplicar uploads (pedido da issue), nunca deixar um perfil salvo
sem imagem, aplicar tem que propagar em tempo real como qualquer edição, e o
domínio `user` não deve conhecer a tabela nova.

## Opções consideradas

1. **Copiar os arquivos ao salvar.** Simples de apagar (cada um é dono do
   seu), mas duplica disco a cada perfil salvo, o que a issue pede para evitar.
2. **Contador de referências na mídia** (tabela `profile_media` com
   `ref_count`). Exato, mas cria uma tabela e um caminho de escrita a mais
   em todo upload/troca, além de migrar os arquivos que já existem.
3. **Referência por URL + "alguém ainda usa?" antes de apagar.** O perfil
   salvo guarda a URL; antes de apagar um arquivo, o `ProfileHandler` pergunta
   a um `MediaKeeper` (interface pequena no `user`, implementada pelo
   repositório de `savedprofile`) se a URL ainda está em `users` ou em
   `saved_profiles`. Na dúvida (erro no banco), o arquivo fica.

## Decisão

Opção 3: nenhuma tabela de mídia nova, nenhuma cópia, e a regra fica num
ponto só (o `removeMedia` que já existe). A consulta usa índices parciais em
`saved_profiles(avatar_url)` e `(banner_url)`. Aplicar troca campos, avatar e
banner numa transação pelo `ProfileService.ApplySnapshot`, que publica o
`user_updated` como as outras edições; as URLs que saíram passam pelo mesmo
`removeMedia`. Excluir um perfil salvo também solta a mídia dele por ali.

## Consequências

- Trocar de avatar continua apagando o arquivo antigo, exceto quando um perfil
  salvo usa; excluir esse perfil salvo (ou aplicar outro) libera.
- Um erro no banco na hora de apagar deixa um arquivo órfão no disco (melhor
  que um perfil salvo quebrado). Uma varredura de órfãos, se um dia fizer
  falta, pode usar a mesma consulta.
- O som de entrada fica fora do perfil salvo (é da pessoa, não do visual do
  cartão, e mora em outra pasta).

## Fontes

- Padrão do repo: `user.ProfileHandler.removeMedia` e `RemoveMediaURL`, já
  usados pelos ícones de servidor e de grupo.
- Contagem de referências e coleta por alcançabilidade (a opção 2 e a 3 são
  as duas formas clássicas de saber quando um recurso compartilhado pode sair).
