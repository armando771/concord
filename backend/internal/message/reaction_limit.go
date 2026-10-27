package message

import "errors"

// MaxDistinctReactions é quantas reações diferentes (emojis distintos) uma
// mensagem aceita, o mesmo limite do Discord. Reagir com um emoji que já está
// na mensagem continua valendo.
const MaxDistinctReactions = 20

var ErrTooManyReactions = errors.New("message already has too many distinct reactions")

// canAddReaction: o emoji já está na mensagem, ou ainda cabe um diferente.
func canAddReaction(distinct int, present bool) bool {
	return present || distinct < MaxDistinctReactions
}
