package dbcontrol

import "embed"

// migrations carries the SQL files into the binary.
//
// The embed root is the package directory, so the SQL lives in
// internal/dbcontrol/migrations/. Keeping it inside the package means the
// migration code and the files it reads cannot drift apart across repositories.
//
//go:embed migrations/postgres/*.sql
var migrations embed.FS
