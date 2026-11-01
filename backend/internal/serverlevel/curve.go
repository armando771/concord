package serverlevel

// Curva do nível do servidor, mais longa que a de pessoas (internal/level):
// servidores juntam o XP de todo mundo. Passar do nível L para o L+1 custa
// 250·L² XP, sem nível máximo. Total para chegar em cada nível:
//
//	nível 2 = 250        nível 3 = 1.250       nível 5 = 7.500
//	nível 10 = 71.250    nível 20 = 617.500    nível 30 = 2.138.750
//
// Um servidor pequeno e ativo (5 pessoas conversando e 1 h de call por dia,
// ~800 XP/dia) passa do nível 5 em uns 10 dias e do 10 em uns 3 meses; o 20
// fica para os grandes.
const xpStep = 250

// XPToNext é quanto XP o nível `level` precisa para subir.
func XPToNext(level int) int64 {
	l := int64(level)
	return xpStep * l * l
}

// FromXP converte o XP total em nível, XP dentro do nível e XP para o próximo.
func FromXP(xp int64) (level int, intoLevel int64, forNext int64) {
	level = 1
	remaining := max(xp, 0)
	for remaining >= XPToNext(level) {
		remaining -= XPToNext(level)
		level++
	}
	return level, remaining, XPToNext(level)
}
