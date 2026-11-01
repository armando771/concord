package main

import (
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
)

// Func é uma função (ou método) com o intervalo de linhas que ocupa no arquivo.
type Func struct {
	File       string  `json:"file"`
	Name       string  `json:"name"`
	Start      int     `json:"start"`
	End        int     `json:"end"`
	Complexity int     `json:"complexity"`
	Coverage   float64 `json:"coverage"`
}

func parseFile(path string) ([]Func, error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, path, nil, parser.SkipObjectResolution)
	if err != nil {
		return nil, err
	}
	var funcs []Func
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Body == nil {
			continue
		}
		funcs = append(funcs, Func{
			File:       filepath.ToSlash(path),
			Name:       funcName(fn),
			Start:      fset.Position(fn.Pos()).Line,
			End:        fset.Position(fn.End()).Line,
			Complexity: complexity(fn.Body),
		})
	}
	return funcs, nil
}

// funcName devolve "Tipo.Metodo" para métodos e o nome puro para funções.
func funcName(fn *ast.FuncDecl) string {
	if fn.Recv == nil || len(fn.Recv.List) == 0 {
		return fn.Name.Name
	}
	typ := fn.Recv.List[0].Type
	if star, ok := typ.(*ast.StarExpr); ok {
		typ = star.X
	}
	if generic, ok := typ.(*ast.IndexExpr); ok {
		typ = generic.X
	}
	if ident, ok := typ.(*ast.Ident); ok {
		return ident.Name + "." + fn.Name.Name
	}
	return fn.Name.Name
}

// complexity segue o gocyclo: 1 + cada if, for, case, && e ||.
func complexity(body *ast.BlockStmt) int {
	total := 1
	ast.Inspect(body, func(n ast.Node) bool {
		if branches(n) {
			total++
		}
		return true
	})
	return total
}

func branches(n ast.Node) bool {
	switch n := n.(type) {
	case *ast.IfStmt, *ast.ForStmt, *ast.RangeStmt:
		return true
	case *ast.CaseClause:
		return n.List != nil
	case *ast.CommClause:
		return n.Comm != nil
	case *ast.BinaryExpr:
		return n.Op == token.LAND || n.Op == token.LOR
	}
	return false
}
