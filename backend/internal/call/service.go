package call

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"sort"
	"sync"
	"time"

	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/conversation"
	"gin-quickstart/backend/internal/server"
	"gin-quickstart/backend/internal/user"

	"github.com/google/uuid"
)

var (
	ErrNotFound       = errors.New("call not found")
	ErrBusy           = errors.New("user is busy in another call")
	ErrCalleeOffline  = errors.New("callee is offline")
	ErrNotParticipant = errors.New("you are not a participant of this conversation")
	ErrBlocked        = errors.New("you cannot call this user")
	ErrNotMember      = errors.New("you are not a member of this server")
	ErrNotAllowed     = errors.New("not allowed")
	ErrInvalidType    = errors.New("invalid call type")
)

type EventPublisher interface {
	SendToUser(userID string, event []byte)
	BroadcastToCall(callID string, event []byte)
	BroadcastToRoom(room string, event []byte)
}

type ParticipantInfo struct {
	UserInfo
	CallID   string    `json:"call_id"`
	UserID   string    `json:"user_id"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joined_at"`
	Muted    bool      `json:"muted"`
	Deafened bool      `json:"deafened"`
	// Impostos por um moderador (silenciar/ensurdecer no servidor).
	ServerMuted    bool `json:"server_muted"`
	ServerDeafened bool `json:"server_deafened"`
}

type StateResponse struct {
	Call          *Call             `json:"call"`
	Participants  []ParticipantInfo `json:"participants"`
	ScreenSharing []string          `json:"screen_sharing,omitempty"`
}

type participantState struct {
	userID   string
	role     string
	joinedAt time.Time
	muted    bool
	deafened bool
	// serverMuted/serverDeafened: impostos por quem tem MUTE/DEAFEN_MEMBERS;
	// duram até o fim da chamada ou até um moderador liberar.
	serverMuted    bool
	serverDeafened bool
	lastSoundAt    time.Time
}

type activeCall struct {
	info         *Call
	participants map[string]*participantState
	inviteeID    string
}

type Service struct {
	repository          *Repository
	publisher           EventPublisher
	conversationService *conversation.Service
	blockedCheck        func(ctx context.Context, a string, b string) (bool, error)
	serverService       *server.Service
	channelService      *channel.Service
	userService         *user.Service
	isOnline            func(userID string) bool
	perms               PermissionSource
	media               MediaAdmin

	mu    sync.RWMutex
	calls map[string]*activeCall
	busy  map[string]string
	// screenSharers: callID -> set de userIDs compartilhando tela (transitório)
	screenSharers map[string]map[string]struct{}

	// Queda do WS de chat só tira o usuário da chamada se ele não voltar dentro
	// desse prazo — a mídia (LiveKit) aguenta quedas curtas sozinha.
	disconnectGrace      time.Duration
	leaveAfterDisconnect func(ctx context.Context, callID string, userID string) error
	// Saída forçada por moderação (trocável nos testes, que não têm banco).
	leaveCall func(ctx context.Context, callID string, userID string) error
	// Nome exibido no token do LiveKit (ver Handler.Token).
	mediaName func(ctx context.Context, userID string) string
	// Dados do usuário nos eventos de tela (trocável nos testes).
	lookupUser  func(ctx context.Context, userID string) (UserInfo, error)
	soundLookup SoundLookup
}

const defaultDisconnectGrace = 15 * time.Second

// SetBlockedCheck liga a checagem de bloqueio da chamada na DM.
func (s *Service) SetBlockedCheck(check func(ctx context.Context, a string, b string) (bool, error)) {
	s.blockedCheck = check
}

func CallService(
	repository *Repository,
	publisher EventPublisher,
	conversationService *conversation.Service,
	serverService *server.Service,
	channelService *channel.Service,
	userService *user.Service,
	isOnline func(userID string) bool,
) *Service {
	s := &Service{
		repository:          repository,
		publisher:           publisher,
		conversationService: conversationService,
		serverService:       serverService,
		channelService:      channelService,
		userService:         userService,
		isOnline:            isOnline,
		calls:               make(map[string]*activeCall),
		busy:                make(map[string]string),
		screenSharers:       make(map[string]map[string]struct{}),
		disconnectGrace:     defaultDisconnectGrace,
	}
	s.leaveAfterDisconnect = s.Leave
	s.leaveCall = s.Leave
	s.lookupUser = s.userInfo
	s.mediaName = func(ctx context.Context, userID string) string {
		info, err := s.userInfo(ctx, userID)
		if err != nil {
			return ""
		}
		return info.DisplayName
	}
	return s
}

func (s *Service) StartDM(ctx context.Context, initiatorID string, conversationID string) (*Call, error) {
	conv, err := s.conversationService.FindByID(ctx, conversationID)
	if err != nil {
		return nil, ErrNotFound
	}

	// Chamada só na DM 1:1 (grupo não liga).
	if conv.IsGroup() || (conv.UserAID != initiatorID && conv.UserBID != initiatorID) {
		return nil, ErrNotParticipant
	}

	calleeID := conv.UserAID
	if initiatorID == conv.UserAID {
		calleeID = conv.UserBID
	}

	if s.blockedCheck != nil {
		if blocked, err := s.blockedCheck(ctx, initiatorID, calleeID); err != nil || blocked {
			return nil, ErrBlocked
		}
	}

	if s.isOnline != nil && !s.isOnline(calleeID) {
		return nil, ErrCalleeOffline
	}

	s.mu.Lock()
	if callID, ok := s.busy[initiatorID]; ok {
		existing := s.calls[callID]
		if existing != nil && existing.info.ConversationID != nil && *existing.info.ConversationID == conversationID {
			info := existing.info
			s.mu.Unlock()
			return info, nil
		}
		s.mu.Unlock()
		return nil, ErrBusy
	}
	if _, ok := s.busy[calleeID]; ok {
		s.mu.Unlock()
		return nil, ErrBusy
	}
	if existing := s.findActiveByScopeLocked(TypeDM, conversationID); existing != nil {
		ac := existing
		s.mu.Unlock()
		return ac.info, nil
	}

	initiatorInfo, err := s.userInfo(ctx, initiatorID)
	if err != nil {
		s.mu.Unlock()
		return nil, err
	}
	calleeInfo, err := s.userInfo(ctx, calleeID)
	if err != nil {
		s.mu.Unlock()
		return nil, err
	}

	call := &Call{
		ID:             uuid.New().String(),
		Type:           TypeDM,
		ConversationID: &conv.ID,
		InitiatorID:    initiatorID,
		Status:         StatusRinging,
	}
	ac := &activeCall{
		info:         call,
		participants: make(map[string]*participantState),
		inviteeID:    calleeID,
	}
	ac.participants[initiatorID] = &participantState{
		userID:   initiatorID,
		role:     RoleMember,
		joinedAt: time.Now(),
	}
	s.calls[call.ID] = ac
	s.busy[initiatorID] = call.ID
	s.mu.Unlock()

	if err := s.repository.Create(ctx, call); err != nil {
		log.Printf("[call] persist call %s failed: %v", call.ID, err)
	}
	if err := s.repository.AddParticipant(ctx, &CallParticipant{
		CallID: call.ID,
		UserID: initiatorID,
		Role:   RoleMember,
	}); err != nil {
		log.Printf("[call] persist participant %s failed: %v", initiatorID, err)
	}

	s.publisher.SendToUser(calleeID, marshalEvent("call:invite", InviteEvent{
		CallID:         call.ID,
		Type:           call.Type,
		Initiator:      initiatorInfo,
		ConversationID: call.ConversationID,
	}))
	s.publisher.SendToUser(initiatorID, marshalEvent("call:ring", RingEvent{
		CallID: call.ID,
		Callee: calleeInfo,
	}))

	return call, nil
}

func (s *Service) StartChannel(ctx context.Context, initiatorID string, channelID string) (*Call, error) {
	ch, err := s.channelService.FindByID(ctx, channelID)
	if err != nil {
		return nil, ErrNotFound
	}

	if err := s.requireConnect(ctx, ch.ID, initiatorID); err != nil {
		return nil, err
	}

	s.mu.Lock()
	if callID, ok := s.busy[initiatorID]; ok {
		existing := s.calls[callID]
		if existing != nil && existing.info.ChannelID != nil && *existing.info.ChannelID == channelID {
			s.mu.Unlock()
			return existing.info, nil
		}
		s.mu.Unlock()
		return nil, ErrBusy
	}
	if existing := s.findActiveByScopeLocked(TypeChannel, channelID); existing != nil {
		ac := existing
		s.mu.Unlock()
		return s.joinLocked(ctx, ac, initiatorID, RoleMember)
	}

	call := &Call{
		ID:          uuid.New().String(),
		Type:        TypeChannel,
		ChannelID:   &ch.ID,
		ServerID:    &ch.ServerID,
		InitiatorID: initiatorID,
		Status:      StatusActive,
	}
	ac := &activeCall{
		info:         call,
		participants: make(map[string]*participantState),
	}
	s.calls[call.ID] = ac
	s.mu.Unlock()

	if err := s.repository.Create(ctx, call); err != nil {
		log.Printf("[call] persist call %s failed: %v", call.ID, err)
	}

	_, err = s.joinLocked(ctx, ac, initiatorID, RoleMember)
	if err != nil {
		return nil, err
	}

	return call, nil
}

func (s *Service) Accept(ctx context.Context, callID string, userID string) error {
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.Unlock()
		return ErrNotFound
	}
	if ac.info.Type == TypeDM && ac.inviteeID != userID {
		s.mu.Unlock()
		return ErrNotAllowed
	}
	if _, ok := ac.participants[userID]; ok {
		s.mu.Unlock()
		return nil
	}
	if otherID, ok := s.busy[userID]; ok && otherID != callID {
		s.mu.Unlock()
		return ErrBusy
	}

	userInfo, err := s.userInfo(ctx, userID)
	if err != nil {
		s.mu.Unlock()
		return err
	}

	now := time.Now()
	ac.participants[userID] = &participantState{
		userID:   userID,
		role:     RoleMember,
		joinedAt: now,
	}
	ac.info.Status = StatusActive
	s.busy[userID] = callID
	callIDCopy := ac.info.ID
	s.mu.Unlock()

	if err := s.repository.AddParticipant(ctx, &CallParticipant{
		CallID: callID,
		UserID: userID,
		Role:   RoleMember,
	}); err != nil {
		log.Printf("[call] persist participant %s failed: %v", userID, err)
	}

	s.publisher.BroadcastToCall(callIDCopy, marshalEvent("call:accept", ResponseEvent{
		CallID: callIDCopy,
		User:   userInfo,
	}))

	return nil
}

func (s *Service) Decline(ctx context.Context, callID string, userID string) error {
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.Unlock()
		return ErrNotFound
	}
	if ac.info.Type == TypeDM && ac.inviteeID != userID {
		s.mu.Unlock()
		return ErrNotAllowed
	}

	userInfo, err := s.userInfo(ctx, userID)
	if err != nil {
		s.mu.Unlock()
		return err
	}
	initiatorID := ac.info.InitiatorID
	s.mu.Unlock()

	s.publisher.SendToUser(initiatorID, marshalEvent("call:decline", ResponseEvent{
		CallID: callID,
		User:   userInfo,
	}))

	return s.End(ctx, callID)
}

func (s *Service) Join(ctx context.Context, callID string, userID string) error {
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok || ac.info.Status == StatusEnded {
		s.mu.Unlock()
		return ErrNotFound
	}
	isChannel := ac.info.Type == TypeChannel
	var channelID string
	if isChannel && ac.info.ChannelID != nil {
		channelID = *ac.info.ChannelID
	}
	s.mu.Unlock()

	if isChannel {
		if err := s.requireConnect(ctx, channelID, userID); err != nil {
			return err
		}
	}

	s.mu.Lock()
	_, err := s.joinLocked(ctx, ac, userID, RoleMember)
	s.mu.Unlock()
	return err
}

func (s *Service) Leave(ctx context.Context, callID string, userID string) error {
	remaining, removed, err := s.detachParticipant(callID, userID)
	if err != nil {
		return err
	}
	if !removed {
		return nil
	}

	if err := s.repository.MarkParticipantLeft(ctx, callID, userID); err != nil {
		log.Printf("[call] persist leave %s failed: %v", userID, err)
	}

	userInfo, err := s.userInfo(ctx, userID)
	if err == nil {
		s.publisher.BroadcastToCall(callID, marshalEvent("call:left", StateEvent{
			CallID: callID,
			User:   userInfo,
		}))
	}

	if remaining == 0 {
		return s.End(ctx, callID)
	}

	return nil
}

// detachParticipant tira o usuário da chamada em memória (participantes,
// ocupado, transmissão). Se ele saiu transmitindo, avisa o servidor na hora
// para o selo LIVE sumir. removed = false se ele não estava na chamada.
func (s *Service) detachParticipant(callID, userID string) (remaining int, removed bool, err error) {
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok {
		s.mu.Unlock()
		return 0, false, ErrNotFound
	}
	if _, ok := ac.participants[userID]; !ok {
		s.mu.Unlock()
		return len(ac.participants), false, nil
	}
	delete(ac.participants, userID)
	delete(s.busy, userID)
	wasSharing := false
	if sharers, ok := s.screenSharers[callID]; ok {
		_, wasSharing = sharers[userID]
		delete(sharers, userID)
	}
	remaining = len(ac.participants)
	var serverID string
	if ac.info.ServerID != nil {
		serverID = *ac.info.ServerID
	}
	channelID := ac.info.ChannelID
	s.mu.Unlock()

	if wasSharing {
		s.publishLive(serverID, LiveEvent{CallID: callID, ChannelID: channelID, UserID: userID, Active: false})
	}
	return remaining, true, nil
}

// publishLive avisa a sala do servidor que alguém entrou/saiu do ar. Chamadas
// sem servidor (DM) não têm lista de canal de voz: nada a fazer.
func (s *Service) publishLive(serverID string, ev LiveEvent) {
	if serverID == "" {
		return
	}
	s.broadcastServer(serverID, ev.ChannelID, marshalEvent("call:live", ev))
}

func (s *Service) End(ctx context.Context, callID string) error {
	if err := s.closeCall(callID); err != nil {
		return err
	}

	if err := s.repository.EndCall(ctx, callID); err != nil {
		log.Printf("[call] persist end %s failed: %v", callID, err)
	}

	s.publisher.BroadcastToCall(callID, marshalEvent("call:ended", EndedEvent{
		CallID: callID,
	}))

	return nil
}

// closeCall tira a chamada da memória. Quem ainda transmitia sai do ar no
// servidor na hora (o selo LIVE não espera o próximo polling).
func (s *Service) closeCall(callID string) error {
	s.mu.Lock()
	ac, ok := s.calls[callID]
	if !ok {
		s.mu.Unlock()
		return ErrNotFound
	}
	for pid := range ac.participants {
		delete(s.busy, pid)
	}
	sharers := s.screenSharers[callID]
	var serverID string
	if ac.info.ServerID != nil {
		serverID = *ac.info.ServerID
	}
	channelID := ac.info.ChannelID
	delete(s.calls, callID)
	delete(s.screenSharers, callID)
	s.mu.Unlock()

	for userID := range sharers {
		s.publishLive(serverID, LiveEvent{CallID: callID, ChannelID: channelID, UserID: userID, Active: false})
	}
	return nil
}

func (s *Service) EndByUser(ctx context.Context, callID string, userID string) error {
	s.mu.RLock()
	_, ok := s.calls[callID]
	var isParticipant bool
	if ok {
		_, isParticipant = s.calls[callID].participants[userID]
	}
	s.mu.RUnlock()
	if !ok {
		return ErrNotFound
	}
	if !isParticipant {
		return ErrNotAllowed
	}
	return s.End(ctx, callID)
}

// SetScreenShare marca/desmarca um participante como compartilhando tela,
// publica call:screen para os demais participantes da chamada e call:live
// para o servidor (selo LIVE na lista do canal de voz).
func (s *Service) SetScreenShare(ctx context.Context, callID string, userID string, active bool) error {
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

	sharers, ok := s.screenSharers[callID]
	if !ok {
		sharers = make(map[string]struct{})
		s.screenSharers[callID] = sharers
	}
	if active {
		sharers[userID] = struct{}{}
	} else {
		delete(sharers, userID)
	}

	targets := make([]string, 0, len(ac.participants))
	for pid := range ac.participants {
		if pid != userID {
			targets = append(targets, pid)
		}
	}
	var serverID string
	if ac.info.ServerID != nil {
		serverID = *ac.info.ServerID
	}
	channelID := ac.info.ChannelID
	s.mu.Unlock()

	s.publishLive(serverID, LiveEvent{CallID: callID, ChannelID: channelID, UserID: userID, Active: active})

	userInfo, err := s.lookupUser(ctx, userID)
	if err != nil {
		return err
	}

	for _, pid := range targets {
		s.publisher.SendToUser(pid, marshalEvent("call:screen", ScreenEvent{
			CallID: callID,
			User:   userInfo,
			Active: active,
		}))
	}
	return nil
}

// SetVoiceState registra se o participante está mudo/ensurdecido e avisa a
// chamada e o servidor (para a lista do canal de voz).
func (s *Service) SetVoiceState(callID string, userID string, muted bool, deafened bool) error {
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
	p.muted = muted
	p.deafened = deafened
	var serverID string
	if ac.info.ServerID != nil {
		serverID = *ac.info.ServerID
	}
	channelID := ac.info.ChannelID
	event := marshalEvent("call:voice", VoiceEvent{
		CallID:         callID,
		ChannelID:      ac.info.ChannelID,
		UserID:         userID,
		Muted:          muted,
		Deafened:       deafened,
		ServerMuted:    p.serverMuted,
		ServerDeafened: p.serverDeafened,
	})
	s.mu.Unlock()

	s.publisher.BroadcastToCall(callID, event)
	if serverID != "" {
		s.broadcastServer(serverID, channelID, event)
	}
	return nil
}

func (s *Service) participantInfos(callID string) []ParticipantInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ac, ok := s.calls[callID]
	if !ok {
		return nil
	}
	return participantInfosLocked(callID, ac)
}

func participantInfosLocked(callID string, ac *activeCall) []ParticipantInfo {
	participants := make([]ParticipantInfo, 0, len(ac.participants))
	for _, p := range ac.participants {
		participants = append(participants, ParticipantInfo{
			CallID:   callID,
			UserID:   p.userID,
			Role:     p.role,
			JoinedAt: p.joinedAt,
			Muted:    p.muted,
			Deafened: p.deafened,

			ServerMuted:    p.serverMuted,
			ServerDeafened: p.serverDeafened,
		})
	}
	// Ordem estável (quem entrou primeiro, depois id): o map muda de ordem a
	// cada leitura e a lista do canal de voz pulava a cada polling.
	sort.Slice(participants, func(i, j int) bool {
		a, b := participants[i], participants[j]
		if !a.JoinedAt.Equal(b.JoinedAt) {
			return a.JoinedAt.Before(b.JoinedAt)
		}
		return a.UserID < b.UserID
	})
	return participants
}

func (s *Service) IsBusy(userID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.busy[userID]
	return ok
}

func (s *Service) IsParticipant(callID string, userID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ac, ok := s.calls[callID]
	if !ok {
		return false
	}
	_, ok = ac.participants[userID]
	return ok
}

func (s *Service) FindActiveByScope(scope string, scopeID string) (*Call, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ac := s.findActiveByScopeLocked(scope, scopeID)
	if ac == nil {
		return nil, ErrNotFound
	}
	return ac.info, nil
}

// ListActiveByServer retorna o estado de todas as chamadas de canal
// ativas em um servidor (para listar conectados nos canais de voz).
func (s *Service) ListActiveByServer(ctx context.Context, serverID string) ([]*StateResponse, error) {
	s.mu.RLock()
	callIDs := make([]string, 0)
	for id, ac := range s.calls {
		if ac.info.Type == TypeChannel && ac.info.ServerID != nil &&
			*ac.info.ServerID == serverID && ac.info.Status != StatusEnded {
			callIDs = append(callIDs, id)
		}
	}
	s.mu.RUnlock()

	states := make([]*StateResponse, 0, len(callIDs))
	for _, id := range callIDs {
		state, err := s.GetState(ctx, id)
		if err != nil {
			continue
		}
		states = append(states, state)
	}
	return states, nil
}

func (s *Service) GetState(ctx context.Context, callID string) (*StateResponse, error) {
	s.mu.RLock()
	ac, ok := s.calls[callID]
	if !ok {
		s.mu.RUnlock()
		return nil, ErrNotFound
	}

	participants := participantInfosLocked(callID, ac)
	callCopy := *ac.info
	screenSharing := make([]string, 0)
	if sharers, ok := s.screenSharers[callID]; ok {
		for uid := range sharers {
			screenSharing = append(screenSharing, uid)
		}
		sort.Strings(screenSharing)
	}
	s.mu.RUnlock()

	for i := range participants {
		info, err := s.userInfo(ctx, participants[i].UserID)
		if err != nil {
			continue
		}
		participants[i].UserInfo = info
	}

	return &StateResponse{
		Call:          &callCopy,
		Participants:  participants,
		ScreenSharing: screenSharing,
	}, nil
}

// HandleDisconnect é chamado quando a última conexão WS do usuário fecha.
// Espera disconnectGrace e só então tira o usuário das chamadas, se ele não
// tiver reconectado nesse meio-tempo.
func (s *Service) HandleDisconnect(userID string) {
	time.AfterFunc(s.disconnectGrace, func() {
		if s.isOnline != nil && s.isOnline(userID) {
			return
		}
		s.leaveAllCalls(userID)
	})
}

func (s *Service) leaveAllCalls(userID string) {
	ctx := context.Background()

	s.mu.RLock()
	callIDs := make([]string, 0)
	for id, ac := range s.calls {
		if _, ok := ac.participants[userID]; ok {
			callIDs = append(callIDs, id)
		}
	}
	s.mu.RUnlock()

	for _, callID := range callIDs {
		if err := s.leaveAfterDisconnect(ctx, callID, userID); err != nil {
			log.Printf("[call] disconnect leave %s failed: %v", userID, err)
		}
	}
}

func (s *Service) HandleCallMessage(userID string, evType string, payload json.RawMessage) {
	ctx := context.Background()

	switch evType {
	case "call:invite":
		var p InvitePayload
		if err := json.Unmarshal(payload, &p); err != nil {
			s.sendError(userID, "", "invalid call:invite payload")
			return
		}
		switch p.Type {
		case TypeDM:
			if _, err := s.StartDM(ctx, userID, p.ConversationID); err != nil {
				s.handleStartError(userID, "", err)
			}
		case TypeChannel:
			if _, err := s.StartChannel(ctx, userID, p.ChannelID); err != nil {
				s.handleStartError(userID, "", err)
			}
		default:
			s.sendError(userID, "", ErrInvalidType.Error())
		}
	case "call:accept":
		var p LeavePayload
		if err := json.Unmarshal(payload, &p); err != nil || p.CallID == "" {
			s.sendError(userID, "", "invalid call:accept payload")
			return
		}
		if err := s.Accept(ctx, p.CallID, userID); err != nil {
			s.sendError(userID, p.CallID, err.Error())
		}
	case "call:decline":
		var p LeavePayload
		if err := json.Unmarshal(payload, &p); err != nil || p.CallID == "" {
			s.sendError(userID, "", "invalid call:decline payload")
			return
		}
		if err := s.Decline(ctx, p.CallID, userID); err != nil {
			s.sendError(userID, p.CallID, err.Error())
		}
	case "call:leave":
		var p LeavePayload
		if err := json.Unmarshal(payload, &p); err != nil || p.CallID == "" {
			s.sendError(userID, "", "invalid call:leave payload")
			return
		}
		if err := s.Leave(ctx, p.CallID, userID); err != nil {
			s.sendError(userID, p.CallID, err.Error())
		}
	case "call:voice":
		var p VoicePayload
		if err := json.Unmarshal(payload, &p); err != nil || p.CallID == "" {
			s.sendError(userID, "", "invalid call:voice payload")
			return
		}
		if err := s.SetVoiceState(p.CallID, userID, p.Muted, p.Deafened); err != nil {
			s.sendError(userID, p.CallID, err.Error())
		}
	case "call:screen":
		var p ScreenPayload
		if err := json.Unmarshal(payload, &p); err != nil || p.CallID == "" {
			s.sendError(userID, "", "invalid call:screen payload")
			return
		}
		if err := s.SetScreenShare(ctx, p.CallID, userID, p.Active); err != nil {
			s.sendError(userID, p.CallID, err.Error())
		}
	case "call:soundboard":
		s.handleSoundboardMessage(ctx, userID, payload)
	default:
		log.Printf("[call] unhandled ws event %q from user %s", evType, userID)
	}
}

func (s *Service) joinLocked(ctx context.Context, ac *activeCall, userID string, role string) (*Call, error) {
	if ac.info.Status == StatusEnded {
		return nil, ErrNotFound
	}
	if _, ok := ac.participants[userID]; ok {
		return ac.info, nil
	}
	if otherID, ok := s.busy[userID]; ok && otherID != ac.info.ID {
		return nil, ErrBusy
	}

	userInfo, err := s.userInfo(ctx, userID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	ac.participants[userID] = &participantState{
		userID:   userID,
		role:     role,
		joinedAt: now,
	}
	ac.info.Status = StatusActive
	s.busy[userID] = ac.info.ID

	if err := s.repository.AddParticipant(ctx, &CallParticipant{
		CallID: ac.info.ID,
		UserID: userID,
		Role:   role,
	}); err != nil {
		log.Printf("[call] persist participant %s failed: %v", userID, err)
	}

	s.publisher.BroadcastToCall(ac.info.ID, marshalEvent("call:joined", StateEvent{
		CallID: ac.info.ID,
		User:   userInfo,
	}))

	return ac.info, nil
}

func (s *Service) findActiveByScopeLocked(scope string, scopeID string) *activeCall {
	for _, ac := range s.calls {
		if ac.info.Status == StatusEnded {
			continue
		}
		switch scope {
		case TypeDM:
			if ac.info.ConversationID != nil && *ac.info.ConversationID == scopeID {
				return ac
			}
		case TypeChannel:
			if ac.info.ChannelID != nil && *ac.info.ChannelID == scopeID {
				return ac
			}
		}
	}
	return nil
}

func (s *Service) userInfo(ctx context.Context, userID string) (UserInfo, error) {
	u, err := s.userService.FindByID(ctx, userID)
	if err != nil {
		return UserInfo{}, err
	}
	return UserInfo{
		ID:          u.ID,
		Username:    u.Username,
		DisplayName: u.DisplayName,
		AvatarURL:   u.AvatarURL,
	}, nil
}

func (s *Service) sendError(userID string, callID string, message string) {
	s.publisher.SendToUser(userID, marshalEvent("call:error", ErrorEvent{
		CallID:  callID,
		Message: message,
	}))
}

func (s *Service) handleStartError(userID string, callID string, err error) {
	if errors.Is(err, ErrBusy) {
		s.publisher.SendToUser(userID, marshalEvent("call:busy", BusyEvent{CallID: callID}))
		return
	}
	s.sendError(userID, callID, err.Error())
}
