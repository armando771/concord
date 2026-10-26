// Command crap lista as funções de arquivos Go com complexidade ciclomática e
// cobertura (fração de statements executados), em JSON. É a metade Go de
// scripts/crap.mjs, que calcula o CRAP e aplica o limite.
//
//	go run ./tools/crap -cover cover.out internal/call/service.go ...
//
// Sem -cover (ou com pacote sem teste), a cobertura é 0.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
)

func main() {
	coverPath := flag.String("cover", "", "coverprofile gerado por go test -coverprofile")
	flag.Parse()
	if err := run(*coverPath, flag.Args(), os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// run mede os arquivos e escreve o JSON em out.
func run(coverPath string, paths []string, out io.Writer) error {
	blocks, err := loadProfile(coverPath)
	if err != nil {
		return err
	}
	all := []Func{}
	for _, path := range paths {
		funcs, err := parseFile(path)
		if err != nil {
			return err
		}
		for i := range funcs {
			funcs[i].Coverage = coverage(funcs[i], blocks)
		}
		all = append(all, funcs...)
	}
	return json.NewEncoder(out).Encode(all)
}
