# ADRs (Architecture Decision Records)

Uma decisão de arquitetura por arquivo, numerada: `NNNN-titulo-curto.md`. Um ADR
não é editado depois de aceito; se a decisão mudar, escreva um novo que
**substitui** o antigo e marque o antigo como "Substituído por NNNN".

Quando escrever: ao escolher um padrão novo para uma feature, adicionar uma
dependência, criar uma pasta/camada nova ou fugir do padrão de
[docs/ai/arquitetura.md](../ai/arquitetura.md). Quando a feature só segue o
padrão existente, não precisa.

## Modelo

```markdown
# NNNN. Título no imperativo (ex.: Usar máquina de estados no fluxo de chamada)

- Status: proposto | aceito | substituído por NNNN
- Data: AAAA-MM-DD

## Contexto
O problema e as forças em jogo (o que muda junto, o que precisa escalar,
testabilidade, restrições do repo).

## Opções consideradas
1. Opção A: como resolveria, prós e contras.
2. Opção B: ...
3. Seguir o padrão atual do repo: ...

## Decisão
A escolhida e por quê (em 2–5 frases).

## Consequências
O que fica mais fácil, o que fica mais difícil, o que precisa ser feito depois.

## Fontes
- Links das referências pesquisadas.
```

## Índice

- [0001. Organizar o código por feature e infraestrutura em platform/](0001-estrutura-por-feature.md)
