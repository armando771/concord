package websocket

import "time"

// activitySlot guarda um tipo de atividade ("em atividade") por usuário, com o
// limite de trocas por segundo. Não tem lock próprio: quem usa segura Hub.mu.
type activitySlot[T any] struct {
	byUser map[string]T
	setAt  map[string]time.Time
	// same diz se a troca não muda nada para quem vê (aí ninguém é avisado).
	same func(prev, next T) bool
}

func newActivitySlot[T any](same func(prev, next T) bool) activitySlot[T] {
	return activitySlot[T]{byUser: make(map[string]T), setAt: make(map[string]time.Time), same: same}
}

// set guarda v; false se veio rápido demais ou se não mudou nada.
func (s *activitySlot[T]) set(userID string, v T, now time.Time) bool {
	if last, ok := s.setAt[userID]; ok && now.Sub(last) < activityMinInterval {
		return false
	}
	s.setAt[userID] = now
	if prev, ok := s.byUser[userID]; ok && s.same(prev, v) {
		return false
	}
	s.byUser[userID] = v
	return true
}

// clear tira a atividade; devolve se havia uma.
func (s *activitySlot[T]) clear(userID string) bool {
	_, had := s.byUser[userID]
	delete(s.byUser, userID)
	return had
}

// drop esquece tudo do usuário (saiu de vez); devolve se havia atividade.
func (s *activitySlot[T]) drop(userID string) bool {
	delete(s.setAt, userID)
	return s.clear(userID)
}

// get devolve uma cópia da atividade, ou nil.
func (s *activitySlot[T]) get(userID string) *T {
	v, ok := s.byUser[userID]
	if !ok {
		return nil
	}
	return &v
}
