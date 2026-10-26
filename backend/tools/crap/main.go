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
	"os"
)

func main() {
	coverPath := flag.String("cover", "", "coverprofile gerado por go test -coverprofile")
	flag.Parse()

	blocks, err := loadProfile(*coverPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	out := []Func{}
	for _, path := range flag.Args() {
		funcs, err := parseFile(path)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		for i := range funcs {
			funcs[i].Coverage = coverage(funcs[i], blocks)
		}
		out = append(out, funcs...)
	}
	if err := json.NewEncoder(os.Stdout).Encode(out); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
