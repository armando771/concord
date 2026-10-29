package call

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"sort"
	"strings"
	"time"
)

// Atividades: jogos web de terceiros abertos junto com a chamada. O servidor
// só guarda (em memória) qual atividade está aberta e o link da sala para quem
// está na chamada — o jogo roda inteiro no site de quem o hospeda.

// activityCooldown: intervalo mínimo entre abrir e trocar o link, por
// participante (cada mudança avisa a chamada inteira), como a mesa de áudio.
// Encerrar não espera.
const activityCooldown = 2 * time.Second

// maxActivityURL limita o link guardado e repassado a todos da chamada.
const maxActivityURL = 512

var (
	ErrUnknownActivity  = errors.New("atividade desconhecida")
	ErrActivityURL      = errors.New("link inválido para esta atividade")
	ErrActivityOwner    = errors.New("só quem abriu a atividade pode encerrá-la")
	ErrActivityCooldown = errors.New("aguarde um instante antes de mudar a atividade de novo")
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
	// players: quem está com o jogo aberto agora (o app avisa ao abrir e ao
	// fechar). Quem abriu está sempre aqui enquanto a atividade existe.
	players map[string]struct{}
}

func (a *callActivity) playerIDs() []string {
	ids := make([]string, 0, len(a.players))
	for id := range a.players {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

type ActivityPayload struct {
	CallID     string `json:"call_id"`
	ActivityID string `json:"activity_id"`
	URL        string `json:"url"`
}

// ActivityPresencePayload: call:activity:join / call:activity:leave (abri ou
// fechei o jogo aqui).
type ActivityPresencePayload struct {
	CallID     string `json:"call_id"`
	ActivityID string `json:"activity_id"`
}

// ActivityEvent: atividade aberta na chamada (call:activity e no estado).
type ActivityEvent struct {
	CallID     string   `json:"call_id"`
	ActivityID string   `json:"activity_id"`
	URL        string   `json:"url"`
	StartedBy  UserInfo `json:"started_by"`
	// Players: ids de quem está jogando (selo na lista e nos tiles).
	Players []string `json:"players"`
}

// ActivityPlayersEvent: quem está jogando mudou (call:activity:players).
type ActivityPlayersEvent struct {
	CallID     string   `json:"call_id"`
	ActivityID string   `json:"activity_id"`
	Players    []string `json:"players"`
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
	p, ok := ac.participants[userID]
	if !ok {
		s.mu.Unlock()
		return ErrNotAllowed
	}
	now := time.Now()
	if s.activityOnCooldownLocked(p, now) {
		s.mu.Unlock()
		return ErrActivityCooldown
	}
	p.lastActivityAt = now
	// Trocar o link (a sala capturada da janela do jogo) mantém quem já está
	// jogando; uma atividade nova começa só com quem a abriu.
	players := map[string]struct{}{userID: {}}
	if prev, ok := s.activities[callID]; ok && prev.activityID == activityID && prev.startedBy.ID == userID {
		for id := range prev.players {
			players[id] = struct{}{}
		}
	}
	act := &callActivity{activityID: activityID, url: link, startedBy: userInfo, players: players}
	s.activities[callID] = act
	playerIDs := act.playerIDs()
	targets := participantIDsLocked(ac)
	s.mu.Unlock()

	s.sendToAll(targets, marshalEvent("call:activity", ActivityEvent{
		CallID:     callID,
		ActivityID: activityID,
		URL:        link,
		StartedBy:  userInfo,
		Players:    playerIDs,
	}))
	return nil
}

// JoinActivity: abri o jogo da atividade aqui. Sem atividade aberta (ou com
// outra no lugar, corrida com o stop/troca) não faz nada.
func (s *Service) JoinActivity(callID, userID, activityID string) error {
	return s.setActivityPlayer(callID, userID, activityID, true)
}

// LeaveActivity: fechei o jogo aqui. Quem abriu não sai da lista por aqui:
// fechar o jogo dele encerra a atividade (StopActivity).
func (s *Service) LeaveActivity(callID, userID, activityID string) error {
	return s.setActivityPlayer(callID, userID, activityID, false)
}

func (s *Service) setActivityPlayer(callID, userID, activityID string, playing bool) error {
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
	if !ok || act.activityID != activityID || act.startedBy.ID == userID {
		s.mu.Unlock()
		return nil
	}
	_, had := act.players[userID]
	if had == playing {
		s.mu.Unlock()
		return nil
	}
	if playing {
		act.players[userID] = struct{}{}
	} else {
		delete(act.players, userID)
	}
	event := activityPlayersEvent(callID, act)
	targets := participantIDsLocked(ac)
	s.mu.Unlock()

	s.sendToAll(targets, event)
	return nil
}

func activityPlayersEvent(callID string, act *callActivity) []byte {
	return marshalEvent("call:activity:players", ActivityPlayersEvent{
		CallID:     callID,
		ActivityID: act.activityID,
		Players:    act.playerIDs(),
	})
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
	// Encerrar nunca espera o cooldown (nem conta para ele): fechar a janela ou
	// clicar em Encerrar logo depois de abrir sempre acaba a atividade.
	delete(s.activities, callID)
	targets := participantIDsLocked(ac)
	s.mu.Unlock()

	s.sendToAll(targets, activityStopEvent(callID, act))
	return nil
}

func (s *Service) activityOnCooldownLocked(p *participantState, now time.Time) bool {
	return !p.lastActivityAt.IsZero() && now.Sub(p.lastActivityAt) < s.activityCooldown
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
		Players:    act.playerIDs(),
	}
}

// dropActivityOfLocked trata a saída de alguém da chamada: se foi quem abriu,
// a atividade acaba; se estava jogando, sai da lista. Devolve o evento a mandar
// (nil se nada mudou); quem chama avisa depois de soltar o lock.
func (s *Service) dropActivityOfLocked(callID, userID string) []byte {
	act, ok := s.activities[callID]
	if !ok {
		return nil
	}
	if act.startedBy.ID == userID {
		delete(s.activities, callID)
		return activityStopEvent(callID, act)
	}
	if _, playing := act.players[userID]; !playing {
		return nil
	}
	delete(act.players, userID)
	return activityPlayersEvent(callID, act)
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

func (s *Service) handleActivityPresenceMessage(userID string, playing bool, payload json.RawMessage) {
	var p ActivityPresencePayload
	if err := json.Unmarshal(payload, &p); err != nil || p.CallID == "" || p.ActivityID == "" {
		s.sendActivityError(userID, "", "atividade inválida")
		return
	}
	if err := s.setActivityPlayer(p.CallID, userID, p.ActivityID, playing); err != nil {
		s.sendActivityError(userID, p.CallID, activityErrorMessage(err))
	}
}

func activityErrorMessage(err error) string {
	switch {
	case errors.Is(err, ErrUnknownActivity), errors.Is(err, ErrActivityURL), errors.Is(err, ErrActivityOwner),
		errors.Is(err, ErrActivityCooldown):
		return err.Error()
	case errors.Is(err, ErrNotAllowed):
		return "só quem está na chamada pode usar atividades"
	case errors.Is(err, ErrNotFound):
		return "chamada não encontrada"
	default:
		return "não foi possível abrir a atividade"
	}
}
