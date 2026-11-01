# Pipeline `/ideia`: da ideia à spec aprovada

Use quando a ideia ainda está vaga ("queria que desse pra...") ou tem mais de
uma forma razoável de fazer. Termina numa spec aprovada, pronta para
[`/feature`](pipeline-feature.md). Nenhum código de produção é escrito aqui.

> Claude: as skills `superpowers:*` vêm do plugin superpowers (ver
> [skills.md](skills.md)). Outros agentes: siga o resumo de cada passo.

## Passos

1. **Contexto** (somente leitura): leia o [AGENTS.md](../../AGENTS.md), os docs do
   domínio (`docs/*.md`) e o código da área. Em exploração ampla, use um subagente
   para não encher o contexto.
2. **Brainstorm**: skill `superpowers:brainstorming`.
   - Uma pergunta por vez (múltipla escolha quando der): objetivo, quem usa, o
     que é sucesso, restrições, fora de escopo.
   - Se a ideia tiver vários subsistemas independentes, divida em várias specs.
   - Texto que o usuário final vai ler (UI, mensagens do bot, e-mails) é
     **aprovado pelo usuário** antes de entrar na spec.
3. **Arquitetura**: siga [arquitetura.md § Escolhendo a arquitetura](arquitetura.md#escolhendo-a-arquitetura-de-uma-feature).
   Pesquise 2–3 padrões na internet, compare com o que o repo já faz e
   recomende um. Se fugir do padrão, rascunhe o ADR (`docs/adr/NNNN-...md`,
   status "proposto").
4. **Abordagens**: apresente 2–3 caminhos com prós e contras e a sua
   recomendação; o usuário escolhe.
5. **Design em seções**: arquitetura, componentes (onde cada arquivo vai morar,
   por feature), fluxo de dados, erros, testes e **comportamento responsivo**
   (360/768/1280 px) para UI. Peça aprovação seção a seção.
6. **Spec**: escreva `docs/superpowers/specs/AAAA-MM-DD-<slug>-design.md` com:
   - Objetivo
   - Decisões (com o porquê)
   - Arquitetura (arquivos e pastas, link do ADR)
   - Textos aprovados
   - Fora de escopo
   - Verificação de ponta a ponta (como provar que funciona)
7. **Auto-revisão**: sem "TBD", sem contradição, sem requisito ambíguo e com o
   escopo cabendo em um PR.
8. **Aprovação**: peça para o usuário revisar a spec. Com a aprovação, ofereça
   seguir direto para [`/feature`](pipeline-feature.md) com a spec.
