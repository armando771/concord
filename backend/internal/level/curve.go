package level

// Curva de níveis (a mesma ideia do MEE6): passar do nível L para o L+1 custa
// 5·L² + 50·L + 100 XP, e cada minuto completo em call rende XPPerMinute.
// Não há nível máximo.
//
// Com 10 XP/min isso dá, em tempo de call falando e ouvindo:
//
//	nível 2  ≈ 16 min      nível 10 ≈ 7,6 h      nível 20 ≈ 40 h
//	nível 30 ≈ 115 h       nível 50 ≈ 450 h      nível 100 ≈ 3.200 h
const XPPerMinute = 10

// XPToNext é quanto XP o nível `level` precisa para subir.
func XPToNext(level int) int64 {
	l := int64(level)
	return 5*l*l + 50*l + 100
}

// FromXP converte o XP total em nível, XP dentro do nível e XP para o próximo.
func FromXP(xp int64) (level int, intoLevel int64, forNext int64) {
	level = 1
	remaining := xp
	for remaining >= XPToNext(level) {
		remaining -= XPToNext(level)
		level++
	}
	return level, remaining, XPToNext(level)
}
