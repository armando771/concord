package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// block é um bloco do coverprofile: arquivo (caminho de import), linha onde
// começa, quantos statements tem e se rodou.
type block struct {
	file       string
	line       int
	statements int
	covered    bool
}

func loadProfile(path string) ([]block, error) {
	if path == "" {
		return nil, nil
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// Com vários pacotes o mesmo bloco pode aparecer mais de uma vez:
	// vale coberto se rodou em qualquer uma.
	seen := map[string]int{}
	var blocks []block
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		key, b, ok := parseBlock(scanner.Text())
		if !ok {
			continue
		}
		if i, dup := seen[key]; dup {
			blocks[i].covered = blocks[i].covered || b.covered
			continue
		}
		seen[key] = len(blocks)
		blocks = append(blocks, b)
	}
	return blocks, scanner.Err()
}

// parseBlock lê "pkg/arq.go:12.34,15.2 3 1".
func parseBlock(line string) (string, block, bool) {
	var file, rest string
	var b block
	var count int
	colon := strings.LastIndex(line, ".go:")
	if colon < 0 {
		return "", b, false
	}
	file, rest = line[:colon+3], line[colon+4:]
	var startCol, endLine, endCol int
	if _, err := fmt.Sscanf(rest, "%d.%d,%d.%d %d %d", &b.line, &startCol, &endLine, &endCol, &b.statements, &count); err != nil {
		return "", b, false
	}
	b.file = file
	b.covered = count > 0
	return file + ":" + strings.Fields(rest)[0], b, true
}

// coverage é a fração dos statements da função que rodaram nos testes.
func coverage(fn Func, blocks []block) float64 {
	total, covered := 0, 0
	for _, b := range blocks {
		if !sameFile(b.file, fn.File) || b.line < fn.Start || b.line > fn.End {
			continue
		}
		total += b.statements
		if b.covered {
			covered += b.statements
		}
	}
	if total == 0 {
		return 0
	}
	return float64(covered) / float64(total)
}

// sameFile compara o caminho de import do profile ("modulo/internal/x.go")
// com o caminho relativo passado na linha de comando ("internal/x.go").
func sameFile(profileFile, path string) bool {
	path = strings.TrimPrefix(path, "./")
	return profileFile == path || strings.HasSuffix(profileFile, "/"+path)
}
