// Package dbcontrol is the data access layer for the Postgres control plane.
//
// The control plane stores Moogo's own state only: accounts, projects, the
// bucket catalog, and audit records. User data never reaches these tables.
package dbcontrol

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/moogo/moogo/internal/config"
	"github.com/moogo/moogo/pkg/logger"
)

// Store is the handle to the control plane.
type Store struct {
	pool      *pgxpool.Pool
	logger    *logger.Logger
	closeOnce bool
}

// Sentinel errors. Handlers map these onto HTTP status codes, which is why they
// are defined here rather than matching on driver error text.
var (
	// ErrNotFound means the requested row does not exist.
	ErrNotFound = errors.New("not found")
	// ErrQuotaExceeded means the request would exceed a configured limit.
	ErrQuotaExceeded = errors.New("quota exceeded")
	// ErrEmailTaken means a registration tried to claim an email that already
	// has an account.
	ErrEmailTaken = errors.New("email already in use")
	// ErrResetTokenInvalid means a password-reset link is unknown, already
	// used, or expired. The three cases are collapsed into one so the API does
	// not reveal which, which would help an attacker probe for valid links.
	ErrResetTokenInvalid = errors.New("reset link is invalid or expired")
	// ErrVerificationTokenInvalid means an address-confirmation link is
	// unknown, already used, or expired. Collapsed for the same reason as
	// ErrResetTokenInvalid.
	ErrVerificationTokenInvalid = errors.New("confirmation link is invalid or expired")
	// ErrEmailNotVerified means the account exists and the password was right,
	// but the address has not been proven yet.
	ErrEmailNotVerified = errors.New("email address is not verified")
	// ErrPasswordNotSet means the account has no password of its own, so there
	// was nothing to replace. It is distinct from ErrNotFound because the row is
	// right there: the column is simply null, which is how a Google-only account
	// is stored.
	ErrPasswordNotSet = errors.New("account has no password")
	// ErrObjectKeyTaken means an upload or rename targeted a key that already
	// exists in the project. Object keys are unique per project, so this is a
	// conflict rather than a bad request: the caller has to pick another name or
	// overwrite deliberately.
	ErrObjectKeyTaken = errors.New("object key already exists")
	// ErrInvalidBucketPolicy means a bucket policy was rejected by a database
	// check constraint, such as an empty allowed-types list or a negative
	// object size limit.
	ErrInvalidBucketPolicy = errors.New("invalid bucket policy")
)

// New opens a connection pool to Postgres and verifies it is reachable.
func New(ctx context.Context, cfg config.Config, log *logger.Logger) (*Store, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}

	poolConfig.MaxConns = cfg.DBMaxConns
	poolConfig.MinConns = cfg.DBMinConns
	poolConfig.MaxConnLifetime = 30 * time.Minute
	poolConfig.MaxConnIdleTime = 5 * time.Minute
	poolConfig.HealthCheckPeriod = 30 * time.Second

	connectCtx, cancel := context.WithTimeout(ctx, cfg.DBConnectTimeout)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(connectCtx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("open postgres pool: %w", err)
	}

	if err := pool.Ping(connectCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	log.Info("control plane connected", logger.Fields{
		"max_conns": cfg.DBMaxConns,
		"min_conns": cfg.DBMinConns,
	})

	store := &Store{pool: pool, logger: log}

	// Migrations run at startup rather than as a separate deploy step. A
	// deployment then cannot ship code that expects a schema the database does
	// not have, and the advisory lock makes it safe for several instances to
	// start at the same moment.
	if err := store.migrate(ctx, migrations); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return store, nil
}

// Close releases the connection pool.
func (store *Store) Close() {
	if store == nil || store.pool == nil || store.closeOnce {
		return
	}
	store.closeOnce = true
	store.pool.Close()
}

// Ping reports whether the control plane is reachable, backing the health
// check endpoint.
func (store *Store) Ping(ctx context.Context) error {
	if store == nil || store.pool == nil {
		return errors.New("store is not initialized")
	}
	return store.pool.Ping(ctx)
}

// isNoRows reports whether a driver error means "no rows matched".
//
// PGX reports this as pgx.ErrNoRows; translating it once here keeps every
// caller free of driver imports.
func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}

// isUniqueViolation reports whether a driver error is a unique-constraint
// failure. Postgres reports this with SQLSTATE 23505; matching on the code
// rather than the message keeps it stable across server versions.
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

// isCheckViolation reports whether a driver error is a check-constraint
// failure. Postgres reports this with SQLSTATE 23514.
//
// It is matched on the code for the same reason as isUniqueViolation: the
// server's message text is not a stable interface, but the SQLSTATE class is.
func isCheckViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23514"
	}
	return false
}
