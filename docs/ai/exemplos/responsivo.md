# Responsivo

**Toda tela e componente novo (ou alterado) tem que funcionar de 360 px de
largura (celular, no app web) até monitores largos**, com mouse, toque e
teclado. O app desktop também é redimensionado: janelas estreitas são caso
comum, não exceção.

## Regras

- **Mobile-first** com os breakpoints do Tailwind (`sm:` 640, `md:` 768, `lg:` 1024,
  `xl:` 1280). Estilo base = tela estreita; breakpoints acrescentam.
- Nada de largura fixa em px para containers (`w-[800px]`): use `w-full` +
  `max-w-*`, `min-w-0`, `flex`/`grid` e `clamp()`.
- Layout com flex/grid, não com medição em JS (`getBoundingClientRect`) para
  posicionar coisas.
- Painéis laterais viram gaveta/sobreposição em tela estreita; modais ocupam a
  tela toda no celular (`inset-0 sm:inset-auto`).
- Texto longo não quebra o layout: `truncate`, `line-clamp-*`, `break-words`, e
  `min-w-0` nos filhos de flex.
- Alvo de toque com pelo menos 40×40 px; hover nunca é o único jeito de achar
  uma ação (no toque não existe hover).
- Use os tokens de `assets/main.css` (`@theme`), não cores e espaçamentos soltos.
- **Verifique**: abra no app web (`yarn dev:web`) e confira 360, 768 e 1280 px
  (DevTools → modo responsivo), de preferência com screenshot no PR.
- Antes do PR de UI, rode a skill
  [web-design-guidelines](../../../.claude/skills/web-design-guidelines/SKILL.md)
  nos arquivos alterados.

## Ruim

```tsx
<div className="flex w-[1100px]">
  <aside className="w-[320px]">{members}</aside>
  <main className="w-[780px]">
    <p className="whitespace-nowrap">{message.content}</p>
    <button className="opacity-0 hover:opacity-100" onClick={onDelete}>
      <TrashIcon />
    </button>
  </main>
</div>
```

Problemas: estoura a tela abaixo de 1100 px, texto longo vaza, a ação só
aparece com hover (some no toque) e o botão de ícone não tem rótulo.

## Bom

```tsx
<div className="flex h-full w-full min-w-0">
  <aside className="hidden w-72 shrink-0 lg:block">{members}</aside>
  <main className="flex min-w-0 flex-1 flex-col">
    <p className="break-words">{message.content}</p>
    <button
      className="size-10 opacity-100 focus-visible:ring-2 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      onClick={onDelete}
      aria-label="Apagar mensagem"
    >
      <TrashIcon aria-hidden="true" />
    </button>
  </main>
  <MembersDrawer className="lg:hidden">{members}</MembersDrawer>
</div>
```
