package music

// Pular a música: quem pediu pula na hora; os outros votam. Extraído do player.go.

func (p *Player) Skip(userID string) SkipResult {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.now == nil || p.closed {
		return SkipResult{Kind: SkipNothing}
	}
	if p.skipped == p.now.ID {
		return SkipResult{Kind: SkipDone}
	}
	if p.now.RequestedBy.ID == userID {
		p.deps.Notify.Public(p.lastTextFor(p.now), TextSkippedBy(p.now.Track.Title, p.now.RequestedBy.Username, p.ChannelName))
		p.skipped = p.now.ID
		p.mixer.Skip()
		return SkipResult{Kind: SkipDone}
	}
	humans := p.deps.Notify.Humans(p.CallID)
	p.votes.Prune(humans)
	added := p.votes.Add(userID)
	needed := NeededVotes(len(humans))
	votes := p.votes.Count()
	if votes >= needed {
		p.skipByVoteLocked(votes, needed)
		return SkipResult{Kind: SkipDone, Votes: votes, Needed: needed}
	}
	p.deps.Notify.PublishState(p)
	if !added {
		return SkipResult{Kind: SkipAlready, Votes: votes, Needed: needed}
	}
	return SkipResult{Kind: SkipVoted, Votes: votes, Needed: needed}
}

func (p *Player) skipByVoteLocked(votes, needed int) {
	if p.skipped == p.now.ID {
		return
	}
	p.skipped = p.now.ID
	p.deps.Notify.Public(p.lastTextFor(p.now), TextSkippedByVote(p.now.Track.Title, votes, needed, p.ChannelName))
	p.votes.Reset()
	p.mixer.Skip()
}

// lastTextFor: o aviso vai para o canal de onde a música foi pedida.
func (p *Player) lastTextFor(it *Item) string {
	if it != nil && it.TextChannelID != "" {
		return it.TextChannelID
	}
	return p.lastText
}

// ParticipantLeft recalcula a votação: com menos gente, metade pode já bastar.
func (p *Player) ParticipantLeft(userID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.watchers, userID)
	if p.now == nil || p.closed {
		return
	}
	humans := p.deps.Notify.Humans(p.CallID)
	p.votes.Prune(humans)
	needed := NeededVotes(len(humans))
	if votes := p.votes.Count(); votes > 0 && votes >= needed {
		p.skipByVoteLocked(votes, needed)
	}
	p.deps.Notify.PublishState(p)
}
