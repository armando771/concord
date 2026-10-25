package auth

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"gin-quickstart/backend/internal/ratelimit"
	"gin-quickstart/backend/internal/user"
)

// dummyPasswordHash é um hash qualquer, com o mesmo custo dos reais. Gerado
// no boot para o primeiro login sem conta não custar dois bcrypts.
var dummyPasswordHash = mustHash("salinha-login-sem-conta")

func mustHash(password string) []byte {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	return hash
}

// loginUsers é a parte do user.Service que o login usa (trocável nos testes).
type loginUsers interface {
	FindLoginByEmail(ctx context.Context, email string) (*user.User, error)
	FindLoginByUsername(ctx context.Context, username string) (*user.User, error)
}

type Handler struct {
	service     *Service
	userService *user.Service
	logins      loginUsers
	guard       *loginGuard
}

func AuthHandler(service *Service, userService *user.Service) *Handler {
	return &Handler{
		service:     service,
		userService: userService,
		logins:      userService,
		guard:       newLoginGuard(),
	}
}

// invalidCredentials é a única resposta de falha do login: não dá para saber
// se a conta existe.
func invalidCredentials(c *gin.Context) {
	c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
}

// tooManyAttempts: mesma mensagem genérica, com 429 e Retry-After.
func tooManyAttempts(c *gin.Context, retry time.Duration) {
	c.Header("Retry-After", ratelimit.RetryAfterSeconds(retry))
	c.JSON(http.StatusTooManyRequests, gin.H{"error": "invalid credentials"})
}

func (h *Handler) Register(c *gin.Context) {
	var input struct {
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
		Email       string `json:"email"`
		Password    string `json:"password"`
		// Aniversário opcional (dia, mês e ano).
		BirthdayDay   *int `json:"birthday_day"`
		BirthdayMonth *int `json:"birthday_month"`
		BirthdayYear  *int `json:"birthday_year"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if err := user.ValidateBirthday(input.BirthdayDay, input.BirthdayMonth, input.BirthdayYear, time.Now()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	newUser := &user.User{
		Username:     input.Username,
		DisplayName:  input.DisplayName,
		Email:        input.Email,
		PasswordHash: string(hashedPassword),
		Active:       true,
	}

	if err := h.userService.Create(c.Request.Context(), newUser); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.BirthdayDay != nil {
		birthday := user.Birthday{Day: input.BirthdayDay, Month: input.BirthdayMonth, Year: input.BirthdayYear, Announce: true}
		if err := h.userService.SetBirthday(c.Request.Context(), newUser.ID, birthday); err != nil {
			log.Printf("[auth] save birthday for %s: %v", newUser.ID, err)
		}
	}

	accessToken, err := h.service.GenerateAccessToken(newUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	refreshToken, err := h.service.GenerateRefreshToken(c.Request.Context(), newUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate refresh token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *Handler) Login(c *gin.Context) {
	var input struct {
		// Login: e-mail ou nome de usuário (campo novo).
		Login string `json:"login"`
		// Email: campo antigo, mantido para os apps desktop já instalados.
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	identifier, ok := ParseLoginIdentifier(input.Login, input.Email)
	var limited *LoginIdentifier
	if ok {
		limited = &identifier
	}
	// Antes de qualquer busca ou bcrypt: por IP (todas as tentativas) e por
	// identificador (falhas). c.ClientIP() só confia nos proxies configurados
	// (internal/clientip).
	if retry, allowed := h.guard.allow(c.ClientIP(), limited); !allowed {
		tooManyAttempts(c, retry)
		return
	}
	if !ok {
		invalidCredentials(c)
		return
	}

	var foundUser *user.User
	var err error
	if identifier.Kind == IdentifierEmail {
		foundUser, err = h.logins.FindLoginByEmail(c.Request.Context(), identifier.Value)
	} else {
		foundUser, err = h.logins.FindLoginByUsername(c.Request.Context(), identifier.Value)
	}
	if err != nil {
		// Gasta o mesmo bcrypt de uma senha errada, para o tempo de resposta
		// também não denunciar que a conta não existe.
		_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(input.Password))
		if errors.Is(err, user.ErrLoginNotFound) {
			h.guard.failed(identifier)
		} else {
			// Banco fora do ar: responde igual, mas fica no log.
			log.Printf("[auth] login lookup: %v", err)
		}
		invalidCredentials(c)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(foundUser.PasswordHash), []byte(input.Password)); err != nil {
		h.guard.failed(identifier)
		invalidCredentials(c)
		return
	}
	h.guard.succeeded(identifier)

	accessToken, err := h.service.GenerateAccessToken(foundUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	refreshToken, err := h.service.GenerateRefreshToken(c.Request.Context(), foundUser.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate refresh token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *Handler) Refresh(c *gin.Context) {
	var input struct {
		RefreshToken string `json:"refresh_token"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	newAccessToken, newRefreshToken, err := h.service.RefreshTokens(c.Request.Context(), input.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  newAccessToken,
		"refresh_token": newRefreshToken,
	})
}

func (h *Handler) Logout(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.Logout(c.Request.Context(), userID.(string)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to logout"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}
