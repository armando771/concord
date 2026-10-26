package main

import (
	"os"
	"path/filepath"
	"testing"
)

const sample = `package sample

type Box struct{}

func Plain() int { return 1 }

func (b *Box) Branchy(xs []int, ok bool) int {
	total := 0
	for _, x := range xs {
		if x > 0 && ok {
			total += x
		}
	}
	switch total {
	case 1:
		return 1
	default:
		return total
	}
}
`

func writeSample(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "sample.go")
	if err := os.WriteFile(path, []byte(sample), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestParseFileComplexidadeEIntervalo(t *testing.T) {
	funcs, err := parseFile(writeSample(t))
	if err != nil {
		t.Fatal(err)
	}
	if len(funcs) != 2 {
		t.Fatalf("esperava 2 funções, veio %d", len(funcs))
	}
	if funcs[0].Name != "Plain" || funcs[0].Complexity != 1 {
		t.Errorf("Plain: %+v", funcs[0])
	}
	// 1 + range + if + && + case 1 (default não conta) = 5
	b := funcs[1]
	if b.Name != "Box.Branchy" || b.Complexity != 5 || b.Start != 7 || b.End != 20 {
		t.Errorf("Branchy: %+v", b)
	}
}

func TestParseBlock(t *testing.T) {
	key, b, ok := parseBlock("mod/internal/x.go:12.34,15.2 3 1")
	if !ok || key != "mod/internal/x.go:12.34,15.2" || b.file != "mod/internal/x.go" || b.line != 12 || b.statements != 3 || !b.covered {
		t.Errorf("parseBlock: %q %+v %v", key, b, ok)
	}
	if _, _, ok := parseBlock("mode: set"); ok {
		t.Error("cabeçalho do profile não é bloco")
	}
}

func TestCoverageSoContaBlocosDaFuncao(t *testing.T) {
	fn := Func{File: "internal/x.go", Start: 10, End: 20}
	blocks := []block{
		{file: "mod/internal/x.go", line: 11, statements: 3, covered: true},
		{file: "mod/internal/x.go", line: 15, statements: 1, covered: false},
		{file: "mod/internal/x.go", line: 30, statements: 9, covered: false}, // outra função
		{file: "mod/internal/y.go", line: 12, statements: 9, covered: false}, // outro arquivo
	}
	if got := coverage(fn, blocks); got != 0.75 {
		t.Errorf("coverage = %v, esperava 0.75", got)
	}
	if got := coverage(fn, nil); got != 0 {
		t.Errorf("sem profile a cobertura é 0, veio %v", got)
	}
}

func TestLoadProfileJuntaBlocosRepetidos(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cover.out")
	profile := "mode: set\nmod/x.go:1.1,2.2 2 0\nmod/x.go:1.1,2.2 2 1\nmod/x.go:3.1,4.2 1 0\n"
	if err := os.WriteFile(path, []byte(profile), 0o644); err != nil {
		t.Fatal(err)
	}
	blocks, err := loadProfile(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(blocks) != 2 || !blocks[0].covered || blocks[1].covered {
		t.Errorf("blocks: %+v", blocks)
	}
}
