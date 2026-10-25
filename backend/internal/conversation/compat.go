package conversation

import (
	"regexp"
	"strconv"
)

// Compatibilidade com apps desktop instalados que não se atualizaram.
//
// Até a 0.6.14 o app lia conv.other_user.id de toda linha de GET
// /conversations; uma DM em grupo (sem other_user) derrubava a tela inteira
// ("Cannot read properties of undefined (reading 'id')"). Esses apps não
// sabem abrir grupo, então recebem só as DMs 1:1.
//
// O app é reconhecido pelo User-Agent padrão do Electron, que traz
// "<productName>/<versão>" (ex.: "Salinha/0.6.12 ... Electron/38.0.0"). O app
// novo pede os grupos com ?include_groups=1, o que também cobre o modo dev
// (versão do package.json). Navegador, User-Agent desconhecido ou versão
// ilegível recebem tudo, como antes.

// Primeira versão do app que mostra DM em grupo.
var groupsMinVersion = [3]int{0, 6, 15}

var desktopUA = regexp.MustCompile(`(?i)\b(?:salinha|concord)/(\d+)\.(\d+)\.(\d+)\b.*\bElectron/`)

func legacyDesktopWithoutGroups(userAgent string) bool {
	m := desktopUA.FindStringSubmatch(userAgent)
	if m == nil {
		return false
	}
	for i, min := range groupsMinVersion {
		n, err := strconv.Atoi(m[i+1])
		if err != nil {
			return false
		}
		if n != min {
			return n < min
		}
	}
	return false
}

// onlyDirectMessages deixa só as linhas que o app antigo sabe mostrar: DM
// 1:1 com other_user preenchido.
func onlyDirectMessages(summaries []Summary) []Summary {
	out := make([]Summary, 0, len(summaries))
	for _, s := range summaries {
		if !s.IsGroup() && s.OtherUser != nil && s.OtherUser.ID != "" {
			out = append(out, s)
		}
	}
	return out
}
