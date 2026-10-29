package serverlevel

// Progress é o nível do servidor do jeito que o cliente mostra (também é o
// payload do "server:level:update").
type Progress struct {
	ServerID    string `json:"server_id"`
	Level       int    `json:"level"`
	XP          int64  `json:"xp"`
	XPIntoLevel int64  `json:"xp_into_level"`
	XPForNext   int64  `json:"xp_for_next"`
}

func newProgress(serverID string, xp int64) Progress {
	level, into, next := FromXP(xp)
	return Progress{ServerID: serverID, Level: level, XP: xp, XPIntoLevel: into, XPForNext: next}
}

// SourceXP é o XP de uma fonte num período.
type SourceXP struct {
	Source string `json:"source"`
	XP     int64  `json:"xp"`
}

// Detail é o nível com o detalhamento dos últimos 7 dias por fonte (aba Nível).
type Detail struct {
	Progress
	Week []SourceXP `json:"week"`
}

// LevelUpEvent ("server:level:up") vai para quem está online no servidor.
type LevelUpEvent struct {
	ServerID      string `json:"server_id"`
	Level         int    `json:"level"`
	PreviousLevel int    `json:"previous_level"`
}
