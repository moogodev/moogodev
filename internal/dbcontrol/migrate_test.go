package dbcontrol

import (
	"io/fs"
	"testing"
	"testing/fstest"
)

func TestParseMigrationName(t *testing.T) {
	testCases := []struct {
		filename    string
		wantVersion int
		wantName    string
		wantErr     bool
	}{
		{filename: "0001_init.sql", wantVersion: 1, wantName: "init"},
		{filename: "0002_bucket_objects.sql", wantVersion: 2, wantName: "bucket_objects"},
		{filename: "0010_add_indexes.sql", wantVersion: 10, wantName: "add_indexes"},

		// A variable width would let "10_x.sql" sort before "9_x.sql" when
		// anything reads the directory as text.
		{filename: "1_init.sql", wantErr: true},
		{filename: "0001.sql", wantErr: true},
		{filename: "00001_init.sql", wantErr: true},
		{filename: "abcd_init.sql", wantErr: true},
		{filename: "0001_.sql", wantErr: true},
	}

	for _, testCase := range testCases {
		t.Run(testCase.filename, func(t *testing.T) {
			version, name, err := parseMigrationName(testCase.filename)
			if testCase.wantErr {
				if err == nil {
					t.Fatalf("expected an error for %q", testCase.filename)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if version != testCase.wantVersion {
				t.Errorf("expected version %d, got %d", testCase.wantVersion, version)
			}
			if name != testCase.wantName {
				t.Errorf("expected name %q, got %q", testCase.wantName, name)
			}
		})
	}
}

func TestLoadMigrationsOrdersByVersion(t *testing.T) {
	// The files are listed out of order on purpose. Ordering has to come from
	// the number, not from the filesystem.
	files := fstest.MapFS{
		"migrations/postgres/0002_second.sql": {Data: []byte("SELECT 2;")},
		"migrations/postgres/0001_first.sql":  {Data: []byte("SELECT 1;")},
		"migrations/postgres/0010_tenth.sql":  {Data: []byte("SELECT 10;")},
	}

	loaded, err := loadMigrations(files)
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	wantVersions := []int{1, 2, 10}
	if len(loaded) != len(wantVersions) {
		t.Fatalf("expected %d migrations, got %d", len(wantVersions), len(loaded))
	}
	for index, want := range wantVersions {
		if loaded[index].Version != want {
			t.Errorf("position %d: expected version %d, got %d",
				index, want, loaded[index].Version)
		}
	}
}

func TestLoadMigrationsComputesChecksum(t *testing.T) {
	files := fstest.MapFS{
		"migrations/postgres/0001_init.sql": {Data: []byte("SELECT 1;")},
	}

	loaded, err := loadMigrations(files)
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	if loaded[0].Checksum == "" {
		t.Error("expected a checksum")
	}

	// The same content must produce the same checksum, or the drift check would
	// fire on every restart.
	again, err := loadMigrations(files)
	if err != nil {
		t.Fatalf("load again: %v", err)
	}
	if again[0].Checksum != loaded[0].Checksum {
		t.Error("the checksum is not stable for identical content")
	}
}

func TestLoadMigrationsRejectsDuplicateVersion(t *testing.T) {
	files := fstest.MapFS{
		"migrations/postgres/0001_init.sql":   {Data: []byte("SELECT 1;")},
		"migrations/postgres/0001_create.sql": {Data: []byte("SELECT 2;")},
	}

	if _, err := loadMigrations(files); err == nil {
		t.Error("expected an error for two files sharing a version")
	}
}

func TestLoadMigrationsRejectsEmptyFile(t *testing.T) {
	files := fstest.MapFS{
		"migrations/postgres/0001_empty.sql": {Data: []byte("   \n\t")},
	}

	if _, err := loadMigrations(files); err == nil {
		t.Error("expected an error for an empty migration")
	}
}

func TestLoadMigrationsIgnoresNonSQL(t *testing.T) {
	files := fstest.MapFS{
		"migrations/postgres/0001_init.sql":  {Data: []byte("SELECT 1;")},
		"migrations/postgres/README.md":      {Data: []byte("notes")},
		"migrations/postgres/0002_data.json": {Data: []byte("{}")},
	}

	loaded, err := loadMigrations(files)
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	if len(loaded) != 1 {
		t.Errorf("expected only the SQL file to be loaded, got %d", len(loaded))
	}
}

func TestLoadMigrationsIgnoresSubdirectories(t *testing.T) {
	files := fstest.MapFS{
		"migrations/postgres/0001_init.sql":     {Data: []byte("SELECT 1;")},
		"migrations/postgres/archive/README.md": {Data: []byte("old")},
	}

	loaded, err := loadMigrations(files)
	if err != nil {
		t.Fatalf("load: %v", err)
	}

	if len(loaded) != 1 {
		t.Errorf("expected only the top-level SQL file, got %d", len(loaded))
	}
}

// ensure the embedded tree really contains the migration files.
func TestEmbeddedMigrationsArePresent(t *testing.T) {
	if _, err := fs.Stat(migrations, "migrations/postgres/0001_init.sql"); err != nil {
		t.Errorf("expected the initial migration to be embedded: %v", err)
	}
}
