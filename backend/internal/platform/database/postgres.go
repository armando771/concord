package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create database pool: %w", err)
	}

	if err := db.Ping(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

const connectRetryInterval = 500 * time.Millisecond

// ConnectWithRetry tenta Connect até dar certo ou passar `wait`: depois de um
// boot da VPS o Postgres do Docker pode levar alguns segundos para aceitar
// conexões. URL inválida falha na hora.
func ConnectWithRetry(databaseURL string, wait time.Duration) (*pgxpool.Pool, error) {
	if _, err := pgxpool.ParseConfig(databaseURL); err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}
	deadline := time.Now().Add(wait)
	for {
		db, err := Connect(databaseURL)
		if err == nil {
			return db, nil
		}
		if time.Now().Add(connectRetryInterval).After(deadline) {
			return nil, err
		}
		log.Printf("banco ainda fora (%v); tentando de novo", err)
		time.Sleep(connectRetryInterval)
	}
}
