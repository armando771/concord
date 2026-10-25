package proposal

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"
)

// --- fake: reações e anexos dos comentários ---

type fakeReact struct{ comment, user, emoji string }

type fakeCAtt struct {
	row     CommentAttachmentRow
	comment string // vazio = pendente
	created time.Time
}

// decorate monta o comentário como o banco devolve: com resposta, reações e anexos.
func (f *fakeStore) decorate(c *Comment) Comment {
	out := *c
	out.Reactions = []ReactionSummary{}
	for _, r := range f.reacts {
		if r.comment != c.ID {
			continue
		}
		i := slices.IndexFunc(out.Reactions, func(s ReactionSummary) bool { return s.Emoji == r.emoji })
		if i < 0 {
			out.Reactions = append(out.Reactions, ReactionSummary{Emoji: r.emoji})
			i = len(out.Reactions) - 1
		}
		out.Reactions[i].Count++
		out.Reactions[i].UserIDs = append(out.Reactions[i].UserIDs, r.user)
	}
	out.Attachments = []CommentAttachment{}
	for _, a := range f.catt {
		if a.comment == c.ID {
			out.Attachments = append(out.Attachments, CommentAttachment{
				ID: a.row.ID, Kind: a.row.Kind, ContentType: a.row.ContentType, Filename: a.row.Filename,
				SizeBytes: a.row.SizeBytes, URL: commentMediaURL(a.row.ID),
			})
		}
	}
	out.ReplyTo = nil
	if c.ReplyToID != nil {
		for _, o := range f.comments {
			if o.ID == *c.ReplyToID {
				out.ReplyTo = &CommentReply{ID: o.ID, AuthorID: o.AuthorID, AuthorName: o.AuthorName, Body: o.Body}
			}
		}
	}
	return out
}

func (f *fakeStore) CreateComment(_ context.Context, proposalID, authorID, body string, mentionIDs []string, replyToID *string, attachmentIDs []string) (string, error) {
	if replyToID != nil {
		ok := false
		for _, c := range f.comments {
			if c.ID == *replyToID && c.ProposalID == proposalID {
				ok = true
			}
		}
		if !ok {
			return "", ErrInvalidReply
		}
	}
	for _, id := range attachmentIDs {
		a := f.catt[id]
		if a == nil || a.comment != "" || a.row.UploaderID != authorID {
			return "", ErrInvalidAttachment
		}
	}
	id := "c" + strconv.Itoa(len(f.comments)+1)
	c := &Comment{ID: id, ProposalID: proposalID, AuthorID: authorID, AuthorName: authorID, Body: body,
		CreatedAt: t0, Mentions: []Mention{}, ReplyToID: replyToID}
	f.comments = append(f.comments, c)
	f.mentions[id] = map[string]bool{}
	for _, uid := range mentionIDs {
		f.mentions[id][uid] = false
		c.Mentions = append(c.Mentions, Mention{ID: uid})
	}
	for _, aid := range attachmentIDs {
		f.catt[aid].comment = id
	}
	return id, nil
}

func (f *fakeStore) AddCommentReaction(_ context.Context, commentID, userID, emoji string) error {
	var distinct []string
	for _, r := range f.reacts {
		if r.comment == commentID {
			if r.user == userID && r.emoji == emoji {
				return nil
			}
			if !slices.Contains(distinct, r.emoji) {
				distinct = append(distinct, r.emoji)
			}
		}
	}
	if !slices.Contains(distinct, emoji) && len(distinct) >= MaxReactionEmojisPerComment {
		return ErrTooManyReactions
	}
	f.reacts = append(f.reacts, fakeReact{commentID, userID, emoji})
	return nil
}

func (f *fakeStore) RemoveCommentReaction(_ context.Context, commentID, userID, emoji string) error {
	f.reacts = slices.DeleteFunc(f.reacts, func(r fakeReact) bool {
		return r.comment == commentID && r.user == userID && r.emoji == emoji
	})
	return nil
}

func (f *fakeStore) CreateCommentAttachment(_ context.Context, a CommentAttachmentRow) error {
	f.catt[a.ID] = &fakeCAtt{row: a, created: t0}
	return nil
}

func (f *fakeStore) CommentAttachmentMeta(_ context.Context, id string) (string, string, error) {
	a := f.catt[id]
	if a == nil {
		return "", "", ErrNotFound
	}
	return a.row.Kind, a.row.ContentType, nil
}

func (f *fakeStore) CommentAttachmentIDs(_ context.Context, commentID string) ([]string, error) {
	var ids []string
	for id, a := range f.catt {
		if a.comment == commentID {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func (f *fakeStore) ProposalCommentAttachmentIDs(_ context.Context, proposalID string) ([]string, error) {
	var ids []string
	for id, a := range f.catt {
		for _, c := range f.comments {
			if c.ID == a.comment && c.ProposalID == proposalID {
				ids = append(ids, id)
			}
		}
	}
	return ids, nil
}

func (f *fakeStore) DeletePendingCommentAttachments(_ context.Context, cutoff time.Time) ([]string, error) {
	var ids []string
	for id, a := range f.catt {
		if a.comment == "" && a.created.Before(cutoff) {
			ids = append(ids, id)
			delete(f.catt, id)
		}
	}
	return ids, nil
}

// --- testes ---

func uploadAtt(t *testing.T, s *Service, id, uploader, kind string) {
	t.Helper()
	_, err := s.RegisterCommentAttachment(context.Background(), CommentAttachmentRow{
		ID: id, UploaderID: uploader, Kind: kind, ContentType: kind + "/x", Filename: id, SizeBytes: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestAddCommentReply(t *testing.T) {
	s, st, _ := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Responder comentário", "", nil)
	other, _ := s.Create(ctx, "u1", "Outra proposta", "", nil)
	orig, _ := s.AddComment(ctx, p.ID, "u1", "pergunta", nil, nil, nil)
	foreign, _ := s.AddComment(ctx, other.ID, "u1", "de outra proposta", nil, nil, nil)
	st.mentionOK["u2"] = true

	reply, err := s.AddComment(ctx, p.ID, "u2", "resposta", nil, &orig.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if reply.ReplyToID == nil || *reply.ReplyToID != orig.ID || reply.ReplyTo == nil || reply.ReplyTo.Body != "pergunta" {
		t.Fatalf("resposta sem prévia do original: %+v", reply)
	}
	if _, err := s.AddComment(ctx, p.ID, "u2", "x", nil, &foreign.ID, nil); !errors.Is(err, ErrInvalidReply) {
		t.Fatalf("responder a comentário de outra proposta: got %v", err)
	}
	ghost := "fantasma"
	if _, err := s.AddComment(ctx, p.ID, "u2", "x", nil, &ghost, nil); !errors.Is(err, ErrInvalidReply) {
		t.Fatalf("responder a comentário que não existe: got %v", err)
	}
}

func TestAddCommentWithAttachments(t *testing.T) {
	s, st, _ := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Anexos nos comentários", "", nil)
	uploadAtt(t, s, "a1", "u2", "image")
	uploadAtt(t, s, "a2", "u2", "video")
	uploadAtt(t, s, "a3", "u3", "audio")

	if _, err := s.AddComment(ctx, p.ID, "u2", "   ", nil, nil, nil); !errors.Is(err, ErrInvalidComment) {
		t.Fatalf("sem texto e sem anexo: got %v", err)
	}
	c, err := s.AddComment(ctx, p.ID, "u2", "", nil, nil, []string{"a1", "a2"})
	if err != nil {
		t.Fatalf("só anexos deveria passar: %v", err)
	}
	if len(c.Attachments) != 2 || c.Attachments[0].URL != commentMediaURL(c.Attachments[0].ID) {
		t.Fatalf("anexos do comentário: %+v", c.Attachments)
	}
	if _, err := s.AddComment(ctx, p.ID, "u2", "outra vez", nil, nil, []string{"a1"}); !errors.Is(err, ErrInvalidAttachment) {
		t.Fatalf("anexo já usado: got %v", err)
	}
	if _, err := s.AddComment(ctx, p.ID, "u2", "de outro", nil, nil, []string{"a3"}); !errors.Is(err, ErrInvalidAttachment) {
		t.Fatalf("anexo enviado por outra pessoa: got %v", err)
	}
	if _, err := s.AddComment(ctx, p.ID, "u3", "repetido", nil, nil, []string{"a3", "a3"}); !errors.Is(err, ErrInvalidAttachment) {
		t.Fatalf("mesmo anexo duas vezes: got %v", err)
	}
	if st.catt["a3"].comment != "" {
		t.Fatal("um comentário recusado não pode consumir o anexo")
	}
	many := make([]string, MaxCommentAttachments+1)
	for i := range many {
		many[i] = "m" + strconv.Itoa(i)
		uploadAtt(t, s, many[i], "u3", "image")
	}
	if _, err := s.AddComment(ctx, p.ID, "u3", "demais", nil, nil, many); !errors.Is(err, ErrInvalidAttachment) {
		t.Fatalf("anexos demais: got %v", err)
	}
	if _, err := s.AddComment(ctx, p.ID, "u3", "no limite", nil, nil, many[:MaxCommentAttachments]); err != nil {
		t.Fatalf("no limite deveria passar: %v", err)
	}
}

func TestEditCommentKeepsAttachmentOnlyComment(t *testing.T) {
	s, _, _ := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Editar comentário com anexo", "", nil)
	uploadAtt(t, s, "a1", "u2", "image")
	withAtt, _ := s.AddComment(ctx, p.ID, "u2", "", nil, nil, []string{"a1"})
	plain, _ := s.AddComment(ctx, p.ID, "u2", "só texto", nil, nil, nil)

	if _, err := s.EditComment(ctx, p.ID, withAtt.ID, "u2", "  "); err != nil {
		t.Fatalf("apagar o texto de quem tem anexo é válido: %v", err)
	}
	if _, err := s.EditComment(ctx, p.ID, plain.ID, "u2", "  "); !errors.Is(err, ErrInvalidComment) {
		t.Fatalf("comentário sem anexo não pode ficar vazio: got %v", err)
	}
}

func TestReactions(t *testing.T) {
	s, _, pub := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Reagir aos comentários", "", nil)
	other, _ := s.Create(ctx, "u1", "Outra proposta", "", nil)
	c, _ := s.AddComment(ctx, p.ID, "u1", "reaja", nil, nil, nil)

	before := pub.events
	got, err := s.React(ctx, p.ID, c.ID, "u2", "👍")
	if err != nil || len(got.Reactions) != 1 || got.Reactions[0].Count != 1 {
		t.Fatalf("reagir: %+v %v", got, err)
	}
	if pub.events != before+1 || !strings.Contains(string(pub.last), "proposal:comment_update") {
		t.Fatalf("a reação precisa avisar todo mundo com proposal:comment_update: %s", pub.last)
	}
	if got, _ = s.React(ctx, p.ID, c.ID, "u2", "👍"); got.Reactions[0].Count != 1 {
		t.Fatal("reagir de novo com o mesmo emoji não pode contar duas vezes")
	}
	if got, _ = s.React(ctx, p.ID, c.ID, "u3", "👍"); got.Reactions[0].Count != 2 || !slices.Equal(got.Reactions[0].UserIDs, []string{"u2", "u3"}) {
		t.Fatalf("duas pessoas no mesmo emoji: %+v", got.Reactions)
	}
	if got, _ = s.React(ctx, p.ID, c.ID, "u2", "🔥"); len(got.Reactions) != 2 {
		t.Fatalf("outro emoji vira outro grupo: %+v", got.Reactions)
	}
	if got, _ = s.Unreact(ctx, p.ID, c.ID, "u2", "👍"); got.Reactions[0].Count != 1 {
		t.Fatalf("tirar a reação: %+v", got.Reactions)
	}
	if _, err := s.Unreact(ctx, p.ID, c.ID, "u2", "👍"); err != nil {
		t.Fatalf("tirar duas vezes é idempotente: %v", err)
	}

	for _, bad := range []string{"", "a b", "\n", strings.Repeat("😀", 9)} {
		if _, err := s.React(ctx, p.ID, c.ID, "u2", bad); !errors.Is(err, ErrInvalidEmoji) {
			t.Fatalf("emoji %q: got %v", bad, err)
		}
	}
	if _, err := s.React(ctx, p.ID, "nope", "u2", "👍"); !errors.Is(err, ErrCommentNotFound) {
		t.Fatalf("comentário que não existe: got %v", err)
	}
	if _, err := s.React(ctx, other.ID, c.ID, "u2", "👍"); !errors.Is(err, ErrCommentNotFound) {
		t.Fatalf("comentário de outra proposta: got %v", err)
	}
}

func TestReactionEmojiLimit(t *testing.T) {
	s, _, _ := newTestService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Muitos emojis", "", nil)
	c, _ := s.AddComment(ctx, p.ID, "u1", "reaja", nil, nil, nil)
	for i := range MaxReactionEmojisPerComment {
		if _, err := s.React(ctx, p.ID, c.ID, "u2", string(rune(0x1F600+i))); err != nil {
			t.Fatalf("emoji %d: %v", i, err)
		}
	}
	if _, err := s.React(ctx, p.ID, c.ID, "u2", "🦄"); !errors.Is(err, ErrTooManyReactions) {
		t.Fatalf("emoji novo depois do limite: got %v", err)
	}
	if _, err := s.React(ctx, p.ID, c.ID, "u3", string(rune(0x1F600))); err != nil {
		t.Fatalf("emoji que já existe ainda aceita outra pessoa: %v", err)
	}
}

func TestDeleteRemovesAttachmentFiles(t *testing.T) {
	s, _, _ := newTestService(nil)
	files := &fakeFiles{}
	s.files = files
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Apagar com anexos", "", nil)
	uploadAtt(t, s, "a1", "u2", "image")
	uploadAtt(t, s, "a2", "u2", "audio")
	c1, _ := s.AddComment(ctx, p.ID, "u2", "um", nil, nil, []string{"a1"})
	_, _ = s.AddComment(ctx, p.ID, "u2", "dois", nil, nil, []string{"a2"})

	if err := s.DeleteComment(ctx, p.ID, c1.ID, "u2"); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(files.removed, []string{"a1"}) {
		t.Fatalf("apagar o comentário apaga o arquivo dele: %v", files.removed)
	}
	if err := s.Delete(ctx, p.ID, "tech"); err != nil {
		t.Fatal(err)
	}
	if !slices.Contains(files.removed, "a2") {
		t.Fatalf("apagar a proposta apaga os arquivos dos comentários: %v", files.removed)
	}
}

func TestTickCleansPendingCommentAttachments(t *testing.T) {
	s, st, _ := newTestService(nil)
	files := &fakeFiles{}
	s.files = files
	ctx := context.Background()
	uploadAtt(t, s, "velho", "u2", "image")
	uploadAtt(t, s, "novo", "u2", "image")
	st.catt["velho"].created = t0.Add(-2 * PendingImageTTL)
	st.catt["novo"].created = t0

	s.Tick(ctx)
	if !slices.Equal(files.removed, []string{"velho"}) {
		t.Fatalf("só o pendente antigo sai: %v", files.removed)
	}
	if _, ok := st.catt["novo"]; !ok {
		t.Fatal("o pendente recente fica")
	}
}
