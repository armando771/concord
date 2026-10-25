// Cada plataforma usa o mesmo manifesto que seu atualizador, sem depender da outra.
(async () => {
  const $$ = (selector) => document.querySelectorAll(selector);
  // Comando de instalação do Linux apontando para este mesmo servidor — só
  // por HTTPS: por HTTP puro qualquer um no caminho trocaria o instalador.
  const DEFAULT_ORIGIN = 'https://salinha.bhrx.com.br';
  const origin = typeof location !== 'undefined' && location.protocol === 'https:'
    ? location.origin
    : DEFAULT_ORIGIN;
  $$('[data-install-cmd]').forEach((el) => {
    el.textContent = `curl -fsSL ${origin}/install.sh | ` + (origin === DEFAULT_ORIGIN ? 'sh' : `SALINHA_URL=${origin} sh`);
  });
  const releases = await Promise.all(['windows', 'linux'].map(async (platform) => {
    const manifest = platform === 'linux' ? 'latest-linux.yml' : 'latest.yml';
    const prefix = platform === 'linux' ? 'AppImage x64 · ' : '';
    try {
      const response = await fetch('/updates/' + manifest, { cache: 'no-store' });
      if (!response.ok) throw new Error(response.status);
      const yml = await response.text();
      const field = (re) => (yml.match(re) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
      const version = field(/^version:[ \t]*(.+)$/m);
      const path = field(/^path:[ \t]*(.+)$/m);
      const size = Number(field(/^[ \t]*size:[ \t]*(\d+)/m));
      const extension = platform === 'linux' ? '.AppImage' : '.exe';
      // Só aceitamos nomes de artefatos locais, nunca URLs ou caminhos externos.
      if (!version || !path || !/^[\w. -]+$/.test(path) || !path.endsWith(extension)) {
        throw new Error('manifesto incompleto ou inválido');
      }
      const mb = size > 0 ? Math.round(size / 1024 / 1024) + ' MB' : '';
      $$(`[data-download="${platform}"]`).forEach((a) => {
        a.href = '/updates/' + encodeURIComponent(path);
        a.setAttribute('download', path);
        a.removeAttribute('aria-disabled');
        a.removeAttribute('tabindex');
      });
      $$(`[data-version-meta="${platform}"]`).forEach((el) => {
        el.textContent = prefix + ['v' + version, mb].filter(Boolean).join(' · ');
      });
      $$(`[data-filename="${platform}"]`).forEach((el) => (el.textContent = path));
      return { platform, version };
    } catch {
      $$(`[data-version-meta="${platform}"]`).forEach((el) => {
        el.textContent = prefix + 'indisponível no momento';
      });
      return null;
    }
  }));
  const release = releases.find((r) => r?.platform === 'windows') || releases.find(Boolean);
  if (!release) {
    $$('[data-version-pill]').forEach((el) => (el.textContent = 'Downloads indisponíveis no momento'));
    return;
  }
  $$('[data-version-pill], [data-version-foot]').forEach((el) => (el.textContent = 'v' + release.version));
  $$('[data-version-toast]').forEach((el) => (el.textContent = 'Salinha v' + release.version));
})();
