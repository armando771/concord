package music

import "time"

type ItemView struct {
	ID          string  `json:"id"`
	VideoID     string  `json:"video_id"`
	Title       string  `json:"title"`
	Artist      string  `json:"artist"`
	Thumbnail   string  `json:"thumbnail"`
	DurationMs  int64   `json:"duration_ms"`
	RequestedBy UserRef `json:"requested_by"`
	HasVideo    bool    `json:"has_video"`
	VideoReady  bool    `json:"video_ready"`
}

type NowView struct {
	Item      ItemView `json:"item"`
	StartedAt int64    `json:"started_at"` // ms desde epoch
}

type SkipView struct {
	Votes  int      `json:"votes"`
	Needed int      `json:"needed"`
	Voters []string `json:"voters"`
}

// State é o payload de music:state (o painel da call).
type State struct {
	CallID     string     `json:"call_id"`
	ChannelID  string     `json:"channel_id"`
	ServerID   string     `json:"server_id"`
	ServerTime int64      `json:"server_time"`
	Closed     bool       `json:"closed,omitempty"`
	Now        *NowView   `json:"now"`
	Queue      []ItemView `json:"queue"`
	Skip       SkipView   `json:"skip"`
}

func itemView(it *Item) ItemView {
	return ItemView{
		ID: it.ID, VideoID: it.Track.VideoID, Title: it.Track.Title, Artist: it.Track.Artist,
		Thumbnail: it.Track.Thumbnail, DurationMs: it.Track.DurationMs, RequestedBy: it.RequestedBy,
		HasVideo: it.Track.HasVideo, VideoReady: it.VideoPath != "",
	}
}

func BuildState(p *Player, now time.Time) State {
	return buildState(p, p.Snapshot(), now)
}

// buildStateLocked é para quem já segura p.mu (PublishState é chamado assim).
func buildStateLocked(p *Player, now time.Time) State {
	return buildState(p, p.snapshotLocked(), now)
}

func buildState(p *Player, s Snapshot, now time.Time) State {
	st := State{
		CallID: p.CallID, ChannelID: p.ChannelID, ServerID: p.ServerID,
		ServerTime: now.UnixMilli(),
		Queue:      make([]ItemView, 0, len(s.Queue)),
		Skip:       SkipView{Votes: len(s.Voters), Needed: s.Needed, Voters: s.Voters},
	}
	if s.Now != nil {
		st.Now = &NowView{Item: itemView(s.Now), StartedAt: s.StartedAt.UnixMilli()}
	}
	for _, it := range s.Queue {
		st.Queue = append(st.Queue, itemView(it))
	}
	return st
}

func ClosedState(p *Player) State {
	return State{CallID: p.CallID, ChannelID: p.ChannelID, ServerID: p.ServerID, Closed: true, Queue: []ItemView{}, Skip: SkipView{Voters: []string{}}}
}
