---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance (accessibility, focus, forms, animation, responsive layout, content handling). Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or before opening a PR that changes UI.
license: MIT (Vercel Labs, see LICENSE)
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

> **Concord:** cópia fixa de `vercel-labs/web-interface-guidelines` (commit `434b7f9`) em
> [guidelines.md](guidelines.md). A skill original baixava as regras da internet a cada uso;
> aqui elas ficam versionadas no repo (atualizar = trocar o arquivo num PR). Regras de
> [AGENTS.md](../../../AGENTS.md) e [docs/ai/exemplos/responsivo.md](../../../docs/ai/exemplos/responsivo.md)
> prevalecem. As regras de hidratação/SSR não se aplicam (o app é SPA).

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read [guidelines.md](guidelines.md) (the rules and the output format)
2. Read the specified files (or ask which files to review)
3. Check against all rules
4. Output findings in the terse `file:line` format from the guidelines
