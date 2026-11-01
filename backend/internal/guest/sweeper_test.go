package guest

import (
	"context"
	"testing"
	"testing/synctest"
	"time"
)

// O sweeper roda a cada intervalo e para quando o contexto acaba.
func TestRunSweeperTicksUntilCancelled(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		w := newWorld()
		ctx, cancel := context.WithCancel(context.Background())
		done := make(chan struct{})
		go func() {
			w.svc.RunSweeper(ctx, time.Minute)
			close(done)
		}()

		time.Sleep(2*time.Minute + time.Second)
		synctest.Wait()
		if w.store.deleted != 2 {
			t.Fatalf("varreduras = %d, want 2 em dois minutos", w.store.deleted)
		}
		cancel()
		<-done
	})
}
