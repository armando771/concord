package guest

import (
	"sync"
	"time"
)

// index: os acessos ativos em memória (usuário -> servidor -> acesso). A
// chamada consulta a cada entrada, token de mídia e revalidação; o banco é a
// fonte da verdade e recarrega o índice na subida (Service.Warm).
type index struct {
	mu     sync.RWMutex
	byUser map[string]map[string]Pass
}

func newIndex() *index {
	return &index{byUser: map[string]map[string]Pass{}}
}

// put guarda o acesso (um por servidor: o mais novo vale).
func (x *index) put(p Pass) {
	x.mu.Lock()
	defer x.mu.Unlock()
	if x.byUser[p.UserID] == nil {
		x.byUser[p.UserID] = map[string]Pass{}
	}
	x.byUser[p.UserID][p.ServerID] = p
}

// remove tira o acesso, se ainda for o mesmo (pelo id).
func (x *index) remove(p Pass) {
	x.mu.Lock()
	defer x.mu.Unlock()
	if cur, ok := x.byUser[p.UserID][p.ServerID]; !ok || cur.ID != p.ID {
		return
	}
	delete(x.byUser[p.UserID], p.ServerID)
	if len(x.byUser[p.UserID]) == 0 {
		delete(x.byUser, p.UserID)
	}
}

// inServer: o acesso ativo do usuário no servidor.
func (x *index) inServer(userID, serverID string, now time.Time) (Pass, bool) {
	x.mu.RLock()
	defer x.mu.RUnlock()
	p, ok := x.byUser[userID][serverID]
	return p, ok && now.Before(p.ExpiresAt)
}

// inChannel: o acesso ativo do usuário que vale neste canal.
func (x *index) inChannel(userID, channelID string, now time.Time) (Pass, bool) {
	x.mu.RLock()
	defer x.mu.RUnlock()
	for _, p := range x.byUser[userID] {
		if p.ChannelID == channelID && now.Before(p.ExpiresAt) {
			return p, true
		}
	}
	return Pass{}, false
}

// latest: o acesso ativo mais novo do usuário (o servidor do selo "Visitante").
func (x *index) latest(userID string, now time.Time) (Pass, bool) {
	x.mu.RLock()
	defer x.mu.RUnlock()
	var best Pass
	found := false
	for _, p := range x.byUser[userID] {
		if now.Before(p.ExpiresAt) && (!found || p.ExpiresAt.After(best.ExpiresAt)) {
			best, found = p, true
		}
	}
	return best, found
}

// moveTo troca o canal permitido do acesso do usuário no servidor.
func (x *index) moveTo(userID, serverID, channelID string) {
	x.mu.Lock()
	defer x.mu.Unlock()
	if p, ok := x.byUser[userID][serverID]; ok {
		p.ChannelID = channelID
		x.byUser[userID][serverID] = p
	}
}

// matching: os acessos que satisfazem a condição (vencidos, de um convite...).
func (x *index) matching(keep func(Pass) bool) []Pass {
	x.mu.RLock()
	defer x.mu.RUnlock()
	out := []Pass{}
	for _, passes := range x.byUser {
		for _, p := range passes {
			if keep(p) {
				out = append(out, p)
			}
		}
	}
	return out
}
