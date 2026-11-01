# Pipeline `/bugfix`: do bug ao PR

Entrada: o sintoma (o que acontece, o que deveria acontecer, como reproduzir,
logs ou print). Se faltar algo para reproduzir, pergunte antes.

> Claude: as skills `superpowers:*` vêm do plugin superpowers (ver
> [skills.md](skills.md)). Outros agentes: siga o resumo de cada passo.

## Passos

1. **Branch isolada**: skill `superpowers:using-git-worktrees`. Branch
   `fix/<slug>` a partir de `origin/develop`.
2. **Causa raiz, não sintoma**: skill `superpowers:systematic-debugging`.
   - Reproduza de forma confiável e leia o erro inteiro.
   - Formule uma hipótese, teste e só então conclua.
   - Nada de "tentar isso pra ver se resolve". Três tentativas sem sucesso é
     sinal de que o problema é de arquitetura: pare e discuta com o usuário.
3. **Teste que reproduz**: skill `superpowers:test-driven-development`. Escreva o
   teste que falha **pelo motivo do bug** antes de corrigir. Bug sem teste de
   regressão não é corrigido.
4. **Baseline**: `node scripts/crap.mjs --files <arquivos que vai alterar>`; guarde
   a saída para o PR.
5. **Correção mínima** na causa raiz. Não "aproveite" para mudar outras coisas
   além do que a regra anti-god exige.
6. **Refatoração obrigatória**: funções tocadas com CRAP ≤ 15 e god file tocado
   sai menor ([exemplos/crap.md](exemplos/crap.md),
   [exemplos/god-files.md](exemplos/god-files.md)). Commit estrutural separado
   do commit da correção.
7. **Verificação**:
   ```bash
   node scripts/affected-tests.mjs pr
   ```
   Skill `superpowers:verification-before-completion`: o teste novo passa, a
   suíte afetada passa, e o sintoma original não acontece mais (descreva como
   conferiu). Bug de UI: confira também o responsivo.
8. **Revisão**: skill `superpowers:requesting-code-review`.
9. **PR**: skill `superpowers:finishing-a-development-branch`. **Confirme com o
   usuário antes de dar push e abrir o PR.** Base `develop`, título
   `fix(<área>): ...`, corpo no [modelo do repo](../../.github/pull_request_template.md)
   com a causa raiz explicada, sem atribuição de IA.
