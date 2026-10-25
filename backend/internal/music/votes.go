package music

import "sort"

// NeededVotes: metade da call (sem o bot), arredondando para cima.
func NeededVotes(humans int) int {
	if humans < 1 {
		return 1
	}
	return (humans + 1) / 2
}

// Votes são os votos para pular a música atual.
type Votes struct{ voters map[string]struct{} }

func NewVotes() *Votes { return &Votes{voters: map[string]struct{}{}} }

// Add devolve false se a pessoa já tinha votado.
func (v *Votes) Add(userID string) bool {
	if _, ok := v.voters[userID]; ok {
		return false
	}
	v.voters[userID] = struct{}{}
	return true
}

func (v *Votes) Count() int { return len(v.voters) }

func (v *Votes) Voters() []string {
	out := make([]string, 0, len(v.voters))
	for id := range v.voters {
		out = append(out, id)
	}
	sort.Strings(out)
	return out
}

// Prune tira o voto de quem saiu da call.
func (v *Votes) Prune(present []string) {
	keep := make(map[string]struct{}, len(present))
	for _, id := range present {
		keep[id] = struct{}{}
	}
	for id := range v.voters {
		if _, ok := keep[id]; !ok {
			delete(v.voters, id)
		}
	}
}

func (v *Votes) Reset() { v.voters = map[string]struct{}{} }
