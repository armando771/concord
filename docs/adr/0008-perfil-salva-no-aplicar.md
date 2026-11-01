# 0008. Salvar o perfil no "Aplicar" de cada editor, sem rascunho nem barra de alterações

- Status: aceito
- Data: 2026-10-27

## Contexto

Configurações → Perfis virou a tela "Perfis" do Discord: uma coluna estreita
de blocos (avatar e banner, cor do banner, tema, nome, pronomes, nota, Sobre
mim, links, som de entrada) e, à direita, o cartão grande como os outros veem.
Tudo se edita em modais com prévia ao vivo e "Aplicar". A versão anterior
guardava um rascunho da tela inteira e só gravava em "Salvar alterações" (a
barra "Cuidado — você tem alterações não salvas!", que tremia ao tentar sair).

Forças: cada modal já tem a prévia e o seu "Aplicar"; com dois passos
("Aplicar" e depois "Salvar") a pessoa acha que já salvou e perde o que fez ao
fechar; o som de entrada já salvava na hora, então a tela misturava os dois
jeitos. O caminho de gravação (`saveProfile`: imagens primeiro, depois os
campos, cada passo que dá certo sai do pendente) já existe e é testado.

## Opções consideradas

1. **Manter o rascunho + "Salvar alterações"** (o que o Discord faz no
   desktop). Prós: dá para desistir de tudo de uma vez. Contras: dois
   "confirmar" para cada mudança, estado pendente em toda a tela, guarda de
   saída no settingsStore, e a mistura com o som de entrada.
2. **Salvar sozinho a cada mudança (autosave)**, sem botão. Prós: zero
   cliques. Contras: o nome, o tema e as cores mudam para todo mundo enquanto
   a pessoa ainda experimenta; um PUT por tecla.
3. **Salvar no "Aplicar" de cada editor.** O modal é o rascunho (Cancelar/Esc
   desfaz); "Aplicar" grava só aquela parte pelo mesmo `saveProfile` e fecha
   quando o servidor confirma. Recorte de imagem: "Aplicar" já envia.
   Remover avatar/banner pede confirmação.

## Decisão

Opção 3. É a mais simples que resolve as forças: um único "confirmar" por
mudança, nenhum estado pendente fora do modal aberto, o mesmo comportamento do
som de entrada e de Minha conta (onde cada "Editar" já salva), e reaproveita o
`saveProfile` (via `settings/lib/profileApply.ts`). Erro do servidor deixa o
modal aberto com o que foi digitado.

## Consequências

- Some o `useProfileEditor` (rascunho), a barra de alterações não salvas e a
  animação dela. O `dirty`/`blockedAt` do `settingsStore` fica sem uso no
  perfil (continua genérico; dá para remover num PR próprio).
- Cada "Aplicar" é uma ida ao servidor; enquanto vai, o modal mostra
  "Salvando…" e as imagens mostram "Enviando a imagem: N%" acima do cartão.
- Não há "desfazer tudo": desistir é Cancelar no modal, antes de aplicar.

## Fontes

- Discord, "Display Name Styles FAQ" (Perfis → Estilo do nome → modal
  próprio): https://support.discord.com/hc/en-us/articles/33833879643927
- SaaS UI, "Autosave and save states UX patterns":
  https://www.saasui.design/blog/saas-autosave-save-states-ux-patterns
- Pattern Playground, "Saving" (autosave × salvar explícito × híbrido):
  https://pattern-playground.onrender.com/patterns/saving
- GitLab Design, "Automatic persistence vs manually saving" (não misturar os
  dois jeitos na mesma tela): https://gitlab.com/gitlab-org/gitlab-design/issues/121
