package call

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"strings"
)

// Atividades: jogos web de terceiros abertos junto com a chamada. O servidor
// só guarda (em memória) qual atividade está aberta e o link da sala para quem
// está na chamada — o jogo roda inteiro no site de quem o hospeda.

// maxActivityURL limita o link guardado e repassado a todos da chamada.
const maxActivityURL = 512

var (
	ErrUnknownActivity = errors.New("atividade desconhecida")
	ErrActivityURL     = errors.New("link inválido para esta atividade")
	ErrActivityOwner   = errors.New("só quem abriu a atividade pode encerrá-la")
)

// activityCatalog: id da atividade -> origens aceitas no link da sala. Igual ao
// catálogo do app (frontend/src/shared/activities.ts).
var activityCatalog = map[string][]string{
	"krunker": {"https://krunker.io"},
}

// ValidateActivityURL confere o link da sala contra as origens da atividade.
// Vazio é aceito: quem entrar abre a página inicial do jogo.
func ValidateActivityURL(activityID, raw string) (string, error) {
	origins, ok := activityCatalog[activityID]
	if !ok {
		return "", ErrUnknownActivity
	}
	link := strings.TrimSpace(raw)
	if link == "" {
		return "", nil
	}
	if len(link) > maxActivityURL {
		return "", ErrActivityURL
	}
	u, err := url.Parse(link)
	if err != nil || u.User != nil || u.Opaque != "" || u.Host == "" {
		return "", ErrActivityURL
	}
	origin := strings.ToLower(u.Scheme) + "://" + strings.ToLower(u.Host)
	for _, allowed := range origins {
		if origin == allowed {
			return link, nil
		}
	}
	return "", ErrActivityURL
}

type callActivity struct {
	activityID string
	url        string
	startedBy  UserInfo
}

type ActivityPayload struct {
	CallID     string `json:"call_id"`
	ActivityID string `json:"activity_id"`
	URL        string `json:"url"`
}

// ActivityEvent: atividade aberta na chamada (call:activity e no estado).
type ActivityEvent struct {
	CallID     string   `json:"call_id"`
	ActivityID string   `json:"activity_id"`
	URL        string   `json:"url"`
	StartedBy  UserInfo `json:"started_by"`
}

type ActivityStopEvent struct {
	CallID     string `json:"call_id"`
	ActivityID string `json:"activity_id"`
	StartedBy  string `json:"started_by"`
}

// StartActivity abre (ou troca o link de) uma atividade na chamada e avisa só
// quem está nela. Quem abre passa a ser o dono: só ele encerra.
func (s *Service) StartActivity(ctx context.Context, callID, userID, activityID, rawURL string) error {
	link, err := ValidateActivityURL(activityID, rawURL)
	if err != nil {
		return err
	}
	if !s.IsParticipant(callID, userID) {
		return ErrNotAllowed
	}
	userInfo, err := s.lookupUser(ctx, userID)
	if err != nil {
		return err
	}

	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.Unlock()
		return ErrNotFound
	}
	if _, ok := ac.participants[userID]; !ok {
		s.mu.Unlock()
		return ErrNotAllowed
	}
	s.activities[callID] = &callActivity{activityID: activityID, url: link, startedBy: userInfo}
	targets := participantIDsLocked(ac)
	s.mu.Unlock()

	s.sendToAll(targets, marshalEvent("call:activity", ActivityEvent{
		CallID:     callID,
		ActivityID: activityID,
		URL:        link,
		StartedBy:  userInfo,
	}))
	return nil
}

// StopActivity encerra a atividade da chamada (só quem abriu).
func (s *Service) StopActivity(callID, userID string) error {
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok {
		s.mu.Unlock()
		return ErrNotFound
	}
	if _, ok := ac.participants[userID]; !ok {
		s.mu.Unlock()
		return ErrNotAllowed
	}
	act, ok := s.activities[callID]
	if !ok {
		s.mu.Unlock()
		return nil
	}
	if act.startedBy.ID != userID {
		s.mu.Unlock()
		return ErrActivityOwner
	}
	delete(s.activities, callID)
	targets := participantIDsLocked(ac)
	s.mu.Unlock()

	s.sendToAll(targets, activityStopEvent(callID, act))
	return nil
}

// ActivityFor devolve a atividade aberta na chamada, só para quem está nela.
func (s *Service) ActivityFor(callID, userID string) *ActivityEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ac, ok := s.calls[callID]
	if !ok {
		return nil
	}
	if _, ok := ac.participants[userID]; !ok {
		return nil
	}
	act, ok := s.activities[callID]
	if !ok {
		return nil
	}
	return &ActivityEvent{
		CallID:     callID,
		ActivityID: act.activityID,
		URL:        act.url,
		StartedBy:  act.startedBy,
	}
}

// dropActivityOfLocked tira a atividade se quem saiu foi quem a abriu. Devolve
// o evento de fim (nil se nada mudou); quem chama avisa depois de soltar o lock.
func (s *Service) dropActivityOfLocked(callID, userID string) []byte {
	act, ok := s.activities[callID]
	if !ok || act.startedBy.ID != userID {
		return nil
	}
	delete(s.activities, callID)
	return activityStopEvent(callID, act)
}

func activityStopEvent(callID string, act *callActivity) []byte {
	return marshalEvent("call:activity:stop", ActivityStopEvent{
		CallID:     callID,
		ActivityID: act.activityID,
		StartedBy:  act.startedBy.ID,
	})
}

func participantIDsLocked(ac *activeCall) []string {
	ids := make([]string, 0, len(ac.participants))
	for pid := range ac.participants {
		ids = append(ids, pid)
	}
	return ids
}

func (s *Service) sendToAll(userIDs []string, event []byte) {
	for _, id := range userIDs {
		s.publisher.SendToUser(id, event)
	}
}

// sendActivityError: nunca call:error — o app encerra a chamada ao receber um.
func (s *Service) sendActivityError(userID, callID, message string) {
	s.publisher.SendToUser(userID, marshalEvent("call:activity:error", ErrorEvent{
		CallID:  callID,
		Message: message,
	}))
}

func (s *Service) handleActivityMessage(ctx context.Context, userID string, payload json.RawMessage) {
	var p ActivityPayload
	if err := json.Unmarshal(payload, &p); err != nil || p.CallID == "" || p.ActivityID == "" {
		s.sendActivityError(userID, "", "atividade inválida")
		return
	}
	if err := s.StartActivity(ctx, p.CallID, userID, p.ActivityID, p.URL); err != nil {
		s.sendActivityError(userID, p.CallID, activityErrorMessage(err))
	}
}

func (s *Service) handleActivityStopMessage(userID string, payload json.RawMessage) {
	var p LeavePayload
	if err := json.Unmarshal(payload, &p); err != nil || p.CallID == "" {
		s.sendActivityError(userID, "", "atividade inválida")
		return
	}
	if err := s.StopActivity(p.CallID, userID); err != nil {
		s.sendActivityError(userID, p.CallID, activityErrorMessage(err))
	}
}

func activityErrorMessage(err error) string {
	switch {
	case errors.Is(err, ErrUnknownActivity), errors.Is(err, ErrActivityURL), errors.Is(err, ErrActivityOwner):
		return err.Error()
	case errors.Is(err, ErrNotAllowed):
		return "só quem está na chamada pode usar atividades"
	case errors.Is(err, ErrNotFound):
		return "chamada não encontrada"
	default:
		return "não foi possível abrir a atividade"
	}
}
