package user

import "bytes"

// netscapeLoop é a extensão que diz quantas vezes o GIF repete. Sem ela, ou com
// um número finito, o navegador toca e congela no último quadro; o avatar ou
// ícone "para de mexer" depois de um tempo. Zero repete para sempre.
var netscapeLoop = []byte{0x21, 0xFF, 0x0B, 'N', 'E', 'T', 'S', 'C', 'A', 'P', 'E', '2', '.', '0', 0x03, 0x01, 0x00, 0x00, 0x00}

// loopForever devolve o GIF repetindo para sempre. Arquivo que não parece GIF
// volta como veio.
func loopForever(data []byte) []byte {
	if len(data) < 13 || !bytes.HasPrefix(data, []byte("GIF8")) {
		return data
	}
	pos := 13
	if data[10]&0x80 != 0 {
		pos += 3 << ((data[10] & 0x07) + 1)
	}
	insertAt := pos
	for pos < len(data) {
		switch data[pos] {
		case 0x21: // extensão: rótulo + sub-blocos
			if pos+2 >= len(data) {
				return data
			}
			label := data[pos+1]
			start := pos + 2
			pos = skipSubBlocks(data, start)
			if pos < 0 {
				return data
			}
			if label == 0xFF && bytes.HasPrefix(data[start+1:], netscapeLoop[3:14]) {
				// start: tamanho(0x0B) + "NETSCAPE2.0" + 0x03 0x01 lo hi
				if start+15 < len(data) && data[start+12] == 0x03 && data[start+13] == 0x01 {
					out := append([]byte(nil), data...)
					out[start+14], out[start+15] = 0, 0
					return out
				}
			}
		default: // primeiro quadro (ou fim): a extensão tem de vir antes
			out := make([]byte, 0, len(data)+len(netscapeLoop))
			out = append(out, data[:insertAt]...)
			out = append(out, netscapeLoop...)
			return append(out, data[insertAt:]...)
		}
	}
	return data
}

// skipSubBlocks devolve a posição depois da sequência de sub-blocos que começa
// em start (cada um com o tamanho na frente, terminando em 0), ou -1.
func skipSubBlocks(data []byte, start int) int {
	pos := start
	for pos < len(data) {
		size := int(data[pos])
		pos += 1 + size
		if size == 0 {
			return pos
		}
	}
	return -1
}
