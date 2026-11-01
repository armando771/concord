package user

import (
	"bytes"
	"testing"
)

// gif mínimo: cabeçalho, tela lógica sem tabela de cores, um quadro 1x1 e fim.
func tinyGIF(ext []byte) []byte {
	b := []byte("GIF89a")
	b = append(b, 1, 0, 1, 0, 0x00, 0, 0)
	b = append(b, ext...)
	b = append(b, 0x2C, 0, 0, 0, 0, 1, 0, 1, 0, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B)
	return b
}

func TestLoopForeverInsertsWhenMissing(t *testing.T) {
	out := loopForever(tinyGIF(nil))
	if !bytes.Contains(out, netscapeLoop) {
		t.Fatal("extensão de repetição não inserida")
	}
}

func TestLoopForeverRewritesFiniteCount(t *testing.T) {
	finite := append([]byte(nil), netscapeLoop...)
	finite[16] = 3
	src := tinyGIF(finite)
	out := loopForever(src)
	if !bytes.Contains(out, netscapeLoop) || len(out) != len(src) {
		t.Fatalf("contagem finita não virou infinita: %v", out)
	}
	if src[13+16] != 3 {
		t.Fatal("entrada foi alterada")
	}
}

func TestLoopForeverLeavesNonGIF(t *testing.T) {
	png := []byte("\x89PNG\r\n\x1a\nxxxxxxxx")
	if !bytes.Equal(loopForever(png), png) {
		t.Fatal("arquivo que não é GIF foi alterado")
	}
}
