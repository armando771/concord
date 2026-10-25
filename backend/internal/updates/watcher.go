package updates

import (
	"bufio"
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// PollInterval é de quanto em quanto tempo o Watcher olha os manifestos.
const PollInterval = 10 * time.Second

// Manifests são os arquivos que os apps leem para saber da versão nova
// (electron-updater): Windows e Linux.
var Manifests = []string{"latest.yml", "latest-linux.yml"}

// Release é uma versão nova publicada num manifesto.
type Release struct {
	File    string `json:"file"`
	Version string `json:"version"`
}

type manifestState struct {
	modTime time.Time
	size    int64
	version string
}

// Watcher observa os manifestos da pasta de atualizações (só o mtime, a cada
// PollInterval) e avisa quando a versão de um deles muda — o backend repassa
// a todos os apps conectados, que checam a atualização na hora em vez de
// esperar a próxima checagem periódica.
type Watcher struct {
	dir      string
	onChange func(Release)
	state    map[string]manifestState
	primed   bool
}

func NewWatcher(dir string, onChange func(Release)) *Watcher {
	return &Watcher{dir: dir, onChange: onChange, state: map[string]manifestState{}}
}

// Run olha agora e depois a cada every, até ctx acabar.
func (w *Watcher) Run(ctx context.Context, every time.Duration) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	for {
		w.Poll()
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// Poll olha os manifestos uma vez. A primeira chamada só aprende as versões
// já publicadas: reiniciar o backend não é release nova.
func (w *Watcher) Poll() {
	for _, name := range Manifests {
		if release, changed := w.check(name); changed && w.primed {
			w.onChange(release)
		}
	}
	w.primed = true
}

func (w *Watcher) check(name string) (Release, bool) {
	path := filepath.Join(w.dir, name)
	info, err := os.Stat(path)
	if err != nil {
		// Sumiu (ou ainda não existe): guarda a última versão vista, para
		// republicar a mesma versão não parecer novidade.
		return Release{}, false
	}
	prev := w.state[name]
	if info.ModTime().Equal(prev.modTime) && info.Size() == prev.size {
		return Release{}, false
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return Release{}, false
	}
	version := parseVersion(data)
	if version == "" {
		// Pego no meio da cópia: não guarda o mtime, tenta de novo depois.
		return Release{}, false
	}
	w.state[name] = manifestState{modTime: info.ModTime(), size: info.Size(), version: version}
	if version == prev.version {
		return Release{}, false
	}
	return Release{File: name, Version: version}, true
}

// parseVersion lê a chave `version` do topo do manifesto do electron-builder
// (sem depender de um parser de YAML: o formato é fixo e pequeno).
func parseVersion(data []byte) string {
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), "\r")
		value, ok := strings.CutPrefix(line, "version:")
		if !ok {
			continue
		}
		return strings.Trim(strings.TrimSpace(value), `'"`)
	}
	return ""
}
