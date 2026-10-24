package updates

import "github.com/gin-gonic/gin"

// Routes serve os arquivos de atualização do app (latest.yml, instalador,
// .blockmap e .sig) gerados por scripts/release-win.sh. Sem listagem de pasta.
func Routes(router *gin.Engine, dir string) {
	router.StaticFS("/updates", gin.Dir(dir, false))
}
