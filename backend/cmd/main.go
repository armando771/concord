package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gin-quickstart/backend/internal/platform/database"
	"gin-quickstart/backend/internal/platform/health"
	"gin-quickstart/backend/internal/platform/lifecycle"
)

// Desligamento (SIGTERM): o processo novo só sobe depois que este sai, então
// cada espera aqui é tempo sem servidor.
const (
	// Requisições comuns em andamento (API, uploads) têm até isso para acabar;
	// o que sobrar é cortado. O TimeoutStopSec do systemd é bem maior.
	shutdownTimeout = 3 * time.Second
	// O 1012 sai na hora; isso é só o quanto se espera o "ok" de cada app
	// (um notebook que dormiu nunca responde).
	wsCloseTimeout = 500 * time.Millisecond
)

func main() {
	// `concord-server capabilities`: o que este binário sabe fazer, sem tocar
	// em banco nem porta. O deploy procura a marca no arquivo (sem executá-lo)
	// para não instalar, com o socket do systemd ativo, um binário que não sabe
	// usá-lo.
	if len(os.Args) > 1 && os.Args[1] == "capabilities" {
		fmt.Println(lifecycle.SocketActivationCapability)
		return
	}

	loadEnv()

	// SIGTERM (systemctl restart/stop) ou Ctrl+C: desliga com calma (ver lifecycle.Run).
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	// Depois de um boot da VPS o Postgres pode subir depois do backend.
	db, err := database.ConnectWithRetry(os.Getenv("DATABASE_URL"), 30*time.Second)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := database.Migrate(db, findMigrationsDir()); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}
	// `concord-server migrate`: só aplica as migrations e sai. O deploy roda
	// assim com o binário antigo ainda no ar; se falhar, nada é reiniciado.
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		log.Println("migrations aplicadas")
		return
	}

	router, streams, readiness := newRouter(db)
	a := wire(ctx, db)
	a.registerRoutes(router)

	srv := &http.Server{Handler: router, ReadHeaderTimeout: 10 * time.Second}
	serve(ctx, stop, srv, readiness, func(ctx context.Context) {
		streams.Interrupt()
		// Não tira ninguém das chamadas: o processo novo as recarrega do banco
		// e os clientes reconectam com o código 1012.
		wsCtx, cancel := context.WithTimeout(ctx, wsCloseTimeout)
		defer cancel()
		a.hub.Shutdown(wsCtx)
	})

	// Os badges gravam o último minuto e as maratonas em andamento (o ctx já
	// foi cancelado pelo SIGTERM); o db.Close do defer vem depois.
	select {
	case <-a.badgeDone:
	case <-time.After(5 * time.Second):
		log.Println("desligamento: badges não terminaram de gravar a tempo")
	}
	log.Println("servidor desligado")
}

// serve abre a porta, marca pronto e atende até o sinal de desligar.
//
// HOST=127.0.0.1 quando há um proxy na frente (Caddy na VPS). Com o
// socket do systemd (deploy/concord-server.socket) a porta fica aberta
// durante o reinício e as conexões esperam na fila; sem ele, a porta só
// abre com tudo pronto. Nos dois casos nada é atendido antes de pronto.
func serve(ctx context.Context, stop context.CancelFunc, srv *http.Server, readiness *health.Readiness, onShutdown func(context.Context)) {
	ln, activated, err := lifecycle.Listen(os.Getenv("HOST") + ":" + envOr("PORT", "8080"))
	if err != nil {
		log.Fatal(err)
	}
	readiness.SetReady()
	if activated {
		log.Printf("servidor pronto em %s (socket do systemd)", ln.Addr())
	} else {
		log.Printf("servidor pronto em %s", ln.Addr())
	}

	err = lifecycle.Run(ctx, srv, ln, shutdownTimeout, func(ctx context.Context) {
		stop() // um segundo SIGTERM/Ctrl+C mata na hora
		readiness.SetStopping()
		onShutdown(ctx)
	})
	if err != nil && !errors.Is(err, context.DeadlineExceeded) {
		log.Fatal(err)
	}
	if err != nil {
		log.Printf("desligamento: requisições ainda em andamento após %s foram cortadas", shutdownTimeout)
	}
}
