package main

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

func loadEnv() {
	candidates := []string{".env", "../.env", "../../.env", "backend/.env"}
	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			if err := godotenv.Load(path); err != nil {
				log.Printf("failed to load %s: %v", path, err)
			}
			return
		}
	}
	log.Println("No .env file found")
}

// envOr devolve a variável de ambiente ou o padrão, se vazia.
func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// envList lê uma lista separada por vírgula, sem itens vazios.
func envList(key string) []string {
	var items []string
	for item := range strings.SplitSeq(os.Getenv(key), ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}
	return items
}

func findMigrationsDir() string {
	// O deploy aplica as migrations novas de uma pasta à parte antes de
	// trocá-las pelas do binário no ar (scripts/deploy-vps.sh).
	if dir := os.Getenv("MIGRATIONS_DIR"); dir != "" {
		return dir
	}
	candidates := []string{"migrations", "../migrations", "../../migrations", "backend/migrations"}
	for _, path := range candidates {
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			return path
		}
	}
	return "migrations"
}
