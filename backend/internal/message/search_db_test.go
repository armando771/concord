package message

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"sort"
	"strings"
	"testing"
	"time"

	"gin-quickstart/backend/internal/database"
	"gin-quickstart/backend/internal/permission"
	"gin-quickstart/backend/internal/ratelimit"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Busca num Postgres de verdade (TEST_DATABASE_URL, banco descartável): a
// migration (pg_trgm + unaccent), o SQL de cada filtro e a autorização ponta
// a ponta (canal escondido não devolve nada).

type searchDB struct {
	ctx      context.Context
	db       *pgxpool.Pool
	router   *gin.Engine
	serverID string
	geral    string
	segredo  string
	convID   string
	users    map[string]string // nome -> id
	msgs     map[string]string // rótulo -> id
}

func newSearchDB(t *testing.T) *searchDB {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL não definido")
	}
	ctx := context.Background()
	db, err := database.Connect(dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	s := &searchDB{ctx: ctx, db: db, users: map[string]string{}, msgs: map[string]string{}}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
	}

	suffix := strings.ReplaceAll(uuid.NewString(), "-", "")[:8]
	for _, name := range []string{"ana", "bia", "caio", "robo"} {
		id := uuid.NewString()
		s.users[name] = id
		exec(`INSERT INTO users (id, username, display_name, email, password_hash, is_bot) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x', $3)`,
			id, name+suffix, name == "robo")
	}
	s.serverID, s.geral, s.segredo, s.convID = uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	ids := []string{}
	for _, id := range s.users {
		ids = append(ids, id)
	}
	t.Cleanup(func() {
		db.Exec(ctx, `DELETE FROM servers WHERE id = $1`, s.serverID)
		db.Exec(ctx, `DELETE FROM conversations WHERE id = $1`, s.convID)
		db.Exec(ctx, `DELETE FROM messages WHERE author_id = ANY($1)`, ids)
		db.Exec(ctx, `DELETE FROM users WHERE id = ANY($1)`, ids)
	})

	exec(`INSERT INTO servers (id, name, icon_url, owner_id) VALUES ($1, 's', '', $2)`, s.serverID, s.users["ana"])
	var everyone string
	if err := db.QueryRow(ctx, `INSERT INTO roles (server_id, name, permissions, is_default) VALUES ($1, '@everyone', $2, TRUE) RETURNING id`,
		s.serverID, permission.DefaultEveryone).Scan(&everyone); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"ana", "bia", "caio", "robo"} {
		exec(`INSERT INTO server_members (server_id, user_id) VALUES ($1, $2)`, s.serverID, s.users[name])
	}
	exec(`INSERT INTO channels (id, server_id, name, type, created_by, position) VALUES ($1, $2, 'Geral', 'text', $3, 0)`, s.geral, s.serverID, s.users["ana"])
	exec(`INSERT INTO channels (id, server_id, name, type, created_by, position) VALUES ($1, $2, 'segredo', 'text', $3, 1)`, s.segredo, s.serverID, s.users["ana"])
	// segredo: só a bia (e a dona, ana) vê.
	exec(`INSERT INTO channel_overwrites (channel_id, target_type, target_id, deny) VALUES ($1, 'role', $2, $3)`, s.segredo, everyone, permission.ViewChannel)
	exec(`INSERT INTO channel_overwrites (channel_id, target_type, target_id, allow) VALUES ($1, 'member', $2, $3)`, s.segredo, s.users["bia"], permission.ViewChannel)
	pair := []string{s.users["ana"], s.users["caio"]}
	sort.Strings(pair)
	exec(`INSERT INTO conversations (id, user_a_id, user_b_id) VALUES ($1, $2, $3)`, s.convID, pair[0], pair[1])

	base := time.Date(2026, 3, 10, 12, 0, 0, 0, time.UTC)
	msg := func(label, author, channelID, convID, content string, at time.Time) {
		t.Helper()
		id := uuid.NewString()
		s.msgs[label] = id
		var ch, cv any
		if channelID != "" {
			ch = channelID
		}
		if convID != "" {
			cv = convID
		}
		exec(`INSERT INTO messages (id, author_id, channel_id, conversation_id, content, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
			id, s.users[author], ch, cv, content, at)
	}
	mention := "@bia" + suffix
	msg("ola", "ana", s.geral, "", "Olá, pessoal! Bora jogar hoje?", base)
	msg("link", "bia", s.geral, "", "olha isso https://exemplo.com/jogo", base.Add(time.Hour))
	msg("foto", "caio", s.geral, "", "", base.AddDate(0, 0, 1))
	msg("mencao", "ana", s.geral, "", "valeu "+mention+", jogando junto", base.AddDate(0, 0, 2))
	msg("quase", "ana", s.geral, "", "email "+mention+"x@ex.com não é menção", base.AddDate(0, 0, 2).Add(time.Minute))
	msg("bot", "robo", s.geral, "", "Lembrete: jogo às 20h", base.AddDate(0, 0, 3))
	msg("enquete", "ana", s.geral, "", "", base.AddDate(0, 0, 4))
	msg("curinga", "bia", s.geral, "", "promoção 50% off", base.AddDate(0, 0, 5))
	msg("segredo", "bia", s.segredo, "", "jogo secreto no canal escondido", base.AddDate(0, 0, 1))
	msg("dm", "caio", "", s.convID, "jogo na DM", base.AddDate(0, 0, 1))
	msg("apagada", "ana", s.geral, "", "jogo apagado", base.AddDate(0, 0, 6))
	exec(`DELETE FROM messages WHERE id = $1`, s.msgs["apagada"])

	exec(`INSERT INTO message_attachments (id, message_id, uploader_id, channel_id, kind, content_type, filename, size_bytes) VALUES ($1, $2, $3, $4, 'image', 'image/png', 'a.png', 10)`,
		uuid.NewString(), s.msgs["foto"], s.users["caio"], s.geral)
	exec(`INSERT INTO polls (message_id, question, expires_at) VALUES ($1, 'Qual jogo?', NOW() + INTERVAL '1 day')`, s.msgs["enquete"])
	exec(`INSERT INTO channel_pinned_messages (channel_id, message_id, pinned_by) VALUES ($1, $2, $3)`, s.geral, s.msgs["ola"], s.users["ana"])

	repo := MessageRepository(db)
	perms := permission.PermissionService(permission.PermissionRepository(db))
	gin.SetMode(gin.TestMode)
	s.router = gin.New()
	h := NewSearchHandler(repo, perms, conversationOnly{convID: s.convID, members: []string{s.users["ana"], s.users["caio"]}})
	h.limiter = ratelimit.New(1<<30, time.Minute, 10)
	auth := func(c *gin.Context) {
		c.Set("userID", c.GetHeader("X-User"))
		c.Next()
	}
	SearchRoutes(s.router.Group("/api"), h, auth)
	return s
}

// conversationOnly: participa quem está em members.
type conversationOnly struct {
	convID  string
	members []string
}

func (a conversationOnly) CanRead(_ context.Context, room Room, userID string) error {
	for _, m := range a.members {
		if room.ConversationID == a.convID && m == userID {
			return nil
		}
	}
	return ErrNoRoomAccess
}

func (a conversationOnly) CanWrite(ctx context.Context, room Room, userID string) error {
	return a.CanRead(ctx, room, userID)
}

// search devolve os rótulos achados (na ordem) e o total.
func (s *searchDB) search(t *testing.T, user, path string, q url.Values) ([]string, int) {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, path+"?"+q.Encode(), nil)
	req.Header.Set("X-User", s.users[user])
	w := httptest.NewRecorder()
	s.router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("%s?%s: status %d %s", path, q.Encode(), w.Code, w.Body)
	}
	var page SearchPage
	if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	byID := map[string]string{}
	for label, id := range s.msgs {
		byID[id] = label
	}
	labels := []string{}
	for _, r := range page.Results {
		labels = append(labels, byID[r.ID])
	}
	return labels, page.Total
}

func (s *searchDB) server(t *testing.T, user string, kv ...string) []string {
	t.Helper()
	labels, _ := s.search(t, user, "/api/servers/"+s.serverID+"/messages/search", params(kv...))
	return labels
}

func sorted(labels []string) []string {
	out := append([]string{}, labels...)
	sort.Strings(out)
	return out
}

func expect(t *testing.T, name string, got []string, want ...string) {
	t.Helper()
	if strings.Join(sorted(got), ",") != strings.Join(sorted(want), ",") {
		t.Errorf("%s = %v, want %v", name, got, want)
	}
}

func TestSearchDB(t *testing.T) {
	s := newSearchDB(t)
	suffix := func(name string) string {
		var username string
		if err := s.db.QueryRow(s.ctx, `SELECT username FROM users WHERE id = $1`, s.users[name]).Scan(&username); err != nil {
			t.Fatal(err)
		}
		return username
	}
	bia, robo := suffix("bia"), suffix("robo")

	t.Run("texto sem acento nem maiúsculas, pedaço de palavra", func(t *testing.T) {
		expect(t, "ola", s.server(t, "caio", "q", "OLA"), "ola")
		expect(t, "jog", s.server(t, "caio", "q", "jog"), "ola", "link", "mencao", "bot")
		expect(t, "todos os termos", s.server(t, "caio", "q", "jogando junto"), "mencao")
		expect(t, "frase", s.server(t, "caio", "q", `"bora jogar"`), "ola")
		expect(t, "50%", s.server(t, "caio", "q", "50%"), "curinga")
		// Sem escapar, "%" e "_" seriam curingas e achariam "50% off".
		expect(t, "% é texto", s.server(t, "caio", "q", "5%f"))
		expect(t, "_ é texto", s.server(t, "caio", "q", "50_"))
	})

	t.Run("autorização: canal escondido e mensagem apagada não aparecem", func(t *testing.T) {
		expect(t, "caio", s.server(t, "caio", "q", "secreto"))
		expect(t, "caio pedindo in:segredo", s.server(t, "caio", "q", "jogo in:segredo"))
		expect(t, "bia", s.server(t, "bia", "q", "secreto"), "segredo")
		expect(t, "apagada", s.server(t, "ana", "q", "apagado"))
		// A DM não aparece na busca do servidor.
		expect(t, "dm fora", s.server(t, "ana", "q", "DM"))
	})

	t.Run("from", func(t *testing.T) {
		expect(t, "from", s.server(t, "caio", "q", "from:"+strings.ToUpper(bia)), "link", "curinga")
		expect(t, "from id", s.server(t, "caio", "from", s.users["bia"]), "link", "curinga")
		expect(t, "from dois", s.server(t, "caio", "q", "jog", "from", bia+","+robo), "link", "bot")
	})

	t.Run("in", func(t *testing.T) {
		expect(t, "in nome", s.server(t, "bia", "q", "jogo in:#geral"), "link", "bot")
		expect(t, "in id", s.server(t, "bia", "q", "jogo", "in", s.segredo), "segredo")
	})

	t.Run("has", func(t *testing.T) {
		expect(t, "link", s.server(t, "caio", "has", "link"), "link")
		expect(t, "imagem", s.server(t, "caio", "has", "imagem"), "foto")
		expect(t, "arquivo", s.server(t, "caio", "has", "arquivo"), "foto")
		expect(t, "video", s.server(t, "caio", "has", "video"))
		expect(t, "enquete", s.server(t, "caio", "has", "enquete"), "enquete")
		expect(t, "link e imagem", s.server(t, "caio", "q", "has:link has:imagem"))
	})

	t.Run("mentions", func(t *testing.T) {
		expect(t, "mentions", s.server(t, "caio", "q", "mentions:@"+bia), "mencao")
	})

	t.Run("datas", func(t *testing.T) {
		expect(t, "during", s.server(t, "caio", "q", "during:2026-03-10"), "ola", "link")
		expect(t, "before", s.server(t, "caio", "q", "jog before:2026-03-12"), "ola", "link")
		expect(t, "after", s.server(t, "caio", "q", "jog after:2026-03-12"), "bot")
		// Em UTC-13, a "ola" (10/03 12h UTC) ainda é dia 9, às 23h; a "link", uma hora
		// depois, já é dia 10.
		expect(t, "fuso", s.server(t, "caio", "q", "during:2026-03-09", "tz_offset", "-780"), "ola")
	})

	t.Run("authorType e pinned", func(t *testing.T) {
		expect(t, "bot", s.server(t, "caio", "q", "authorType:bot"), "bot")
		expect(t, "user", s.server(t, "caio", "q", "jog authorType:user"), "ola", "link", "mencao")
		expect(t, "pinned", s.server(t, "caio", "q", "pinned:true"), "ola")
		expect(t, "não fixada", s.server(t, "caio", "q", "jog pinned:false"), "link", "mencao", "bot")
	})

	t.Run("ordem e páginas", func(t *testing.T) {
		got := s.server(t, "caio", "q", "jog")
		if strings.Join(got, ",") != "bot,mencao,link,ola" {
			t.Errorf("newest = %v", got)
		}
		got = s.server(t, "caio", "q", "jog", "sort", "oldest")
		if strings.Join(got, ",") != "ola,link,mencao,bot" {
			t.Errorf("oldest = %v", got)
		}
		got = s.server(t, "caio", "q", "jogo", "sort", "relevance")
		if len(got) != 2 {
			t.Errorf("relevance = %v", got)
		}
		labels, total := s.search(t, "caio", "/api/servers/"+s.serverID+"/messages/search", params("q", "jog", "limit", "2", "offset", "2"))
		if strings.Join(labels, ",") != "link,ola" || total != 4 {
			t.Errorf("página 2 = %v (total %d)", labels, total)
		}
	})

	t.Run("conversa", func(t *testing.T) {
		labels, _ := s.search(t, "caio", "/api/conversations/"+s.convID+"/messages/search", params("q", "jogo"))
		expect(t, "dm", labels, "dm")
		req, _ := http.NewRequest(http.MethodGet, "/api/conversations/"+s.convID+"/messages/search?q=jogo", nil)
		req.Header.Set("X-User", s.users["bia"])
		w := httptest.NewRecorder()
		s.router.ServeHTTP(w, req)
		if w.Code != http.StatusNotFound {
			t.Errorf("bia fora da DM: %d", w.Code)
		}
	})

	t.Run("índice de trigramas atende o texto", func(t *testing.T) {
		tx, err := s.db.Begin(s.ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(s.ctx)
		if _, err := tx.Exec(s.ctx, `SET LOCAL enable_seqscan = off`); err != nil {
			t.Fatal(err)
		}
		rows, err := tx.Query(s.ctx, `EXPLAIN SELECT id FROM messages m WHERE search_normalize(m.content) LIKE '%' || search_normalize('jogando'::text) || '%'`)
		if err != nil {
			t.Fatal(err)
		}
		var plan strings.Builder
		for rows.Next() {
			var line string
			_ = rows.Scan(&line)
			plan.WriteString(line + "\n")
		}
		rows.Close()
		if !strings.Contains(plan.String(), "idx_messages_content_search") {
			t.Errorf("plano sem o índice:\n%s", plan.String())
		}
	})
}
