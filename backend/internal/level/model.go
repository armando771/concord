package level

// Progress é o nível de alguém do jeito que o cliente mostra.
type Progress struct {
	UserID       string `json:"user_id"`
	Level        int    `json:"level"`
	XP           int64  `json:"xp"`
	XPIntoLevel  int64  `json:"xp_into_level"`
	XPForNext    int64  `json:"xp_for_next"`
	VoiceSeconds int64  `json:"voice_seconds"`
}

func newProgress(userID string, xp int64, voiceSeconds int64) Progress {
	level, into, next := FromXP(xp)
	return Progress{
		UserID:       userID,
		Level:        level,
		XP:           xp,
		XPIntoLevel:  into,
		XPForNext:    next,
		VoiceSeconds: voiceSeconds,
	}
}

// LevelUpEvent vai para a chamada, o servidor (lista do canal de voz) e a
// própria pessoa, para todo mundo ver a animação.
type LevelUpEvent struct {
	UserID        string  `json:"user_id"`
	Level         int     `json:"level"`
	PreviousLevel int     `json:"previous_level"`
	CallID        string  `json:"call_id"`
	ServerID      *string `json:"server_id,omitempty"`
}

// BoostEvent diz à chamada qual o buff de XP dela agora. Vai a cada tick
// enquanto há buff (quem entra depois recebe no tick seguinte) e uma última
// vez com Percent 100 quando o buff acaba.
type BoostEvent struct {
	CallID   string `json:"call_id"`
	Percent  int    `json:"percent"`
	Eligible int    `json:"eligible"`
}
