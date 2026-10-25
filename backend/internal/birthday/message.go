package birthday

import (
	"strings"
	"time"
)

// SystemKind marca a mensagem de aniversário enviada pelo servidor.
const SystemKind = "birthday"

// FormatMessage monta o texto aprovado da mensagem do servidor:
// "🎂 O servidor Galera deseja um feliz aniversário para @ana, @bia e @caio!
// Muitas felicidades e ótimas calls! 🎉"
func FormatMessage(serverName string, usernames []string) string {
	mentions := make([]string, len(usernames))
	for i, u := range usernames {
		mentions[i] = "@" + u
	}
	return "🎂 O servidor " + serverName + " deseja um feliz aniversário para " +
		joinNames(mentions) + "! Muitas felicidades e ótimas calls! 🎉"
}

// joinNames: "a", "a e b", "a, b e c".
func joinNames(names []string) string {
	switch len(names) {
	case 0:
		return ""
	case 1:
		return names[0]
	default:
		return strings.Join(names[:len(names)-1], ", ") + " e " + names[len(names)-1]
	}
}

// DatesToCelebrate diz que aniversários comemorar no dia `day`: o próprio
// dia e, em 28 de fevereiro de ano não bissexto, também quem faz em 29/02.
func DatesToCelebrate(day time.Time) (month int, days []int) {
	month = int(day.Month())
	days = []int{day.Day()}
	if day.Month() == time.February && day.Day() == 28 && !isLeap(day.Year()) {
		days = append(days, 29)
	}
	return month, days
}

func isLeap(year int) bool {
	return year%4 == 0 && (year%100 != 0 || year%400 == 0)
}

// IsBirthday diz se quem nasceu em dia/mês faz aniversário no dia `day`.
func IsBirthday(birthDay, birthMonth int, day time.Time) bool {
	month, days := DatesToCelebrate(day)
	if birthMonth != month {
		return false
	}
	for _, d := range days {
		if d == birthDay {
			return true
		}
	}
	return false
}
