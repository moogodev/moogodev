-- 0015_database_backups.sql — backups of each project's SQLite file.
--
-- Two tables, because they answer two different questions. `database_backups`
-- is the append-only history the dashboard lists and the restore menu picks
-- from. `database_backup_state` is one row per project summarizing where the
-- scheduler stands: when the last backup succeeded, what it saw on disk, and
-- whether recent attempts have been failing.
--
-- The state is kept apart from the history on purpose. The scheduler asks "is
-- this project due?" on every tick for every project, and answering that from
-- an aggregate over the history would grow more expensive as the history does,
-- while the answer is always in the newest row.
--
-- Both tables hang off projects with ON DELETE CASCADE. Account deletion is a
-- single statement against users and relies on the cascade to take everything
-- below it; a table that did not participate would be left pointing at a
-- project that no longer exists.

-- The backup history.
--
-- Every row is a backup that already finished uploading. A failed attempt is
-- not a row here: it lives in database_backup_state.last_error, so a listing
-- of this table never offers a file that is not actually in the bucket.
CREATE TABLE database_backups (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id         uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- kind tells the restore menu what it is looking at. The values are the
    -- ones the service writes: 'initial' (uploaded at creation), 'daily',
    -- 'manual', 'pre_restore'. It is text rather than an enum because the set
    -- is expected to grow, and adding a value to a Postgres enum is its own
    -- migration while a text column is not.
    kind               text NOT NULL,

    -- object_key is the full key inside the backup bucket, including the
    -- project prefix. It is stored rather than derived so a change to the key
    -- layout cannot silently point old rows at keys that do not exist.
    object_key         text NOT NULL,

    size_bytes         bigint NOT NULL,
    sha256             text NOT NULL,

    -- source_modified_at is the newest mtime among the .db, -wal and -shm
    -- files at the moment the snapshot was taken. The scheduler compares it
    -- against the same value from a later tick to decide whether anything has
    -- changed since.
    source_modified_at timestamptz,

    created_at         timestamptz NOT NULL DEFAULT now()
);

-- The listing and the retention sweep both read one project's rows newest
-- first, so the index matches that access pattern.
CREATE INDEX database_backups_project_created_idx
    ON database_backups (project_id, created_at DESC);

-- The scheduler's per-project cursor.
--
-- A project with no row here has never been backed up and is due immediately.
-- The row is created on the first attempt, success or failure.
CREATE TABLE database_backup_state (
    project_id             uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,

    -- last_success_at is the freshness clock the scheduler schedules against.
    -- It also advances when a tick finds nothing changed: the existing backup
    -- is still current then, so "due" is the wrong answer.
    last_success_at        timestamptz,

    last_size_bytes        bigint NOT NULL DEFAULT 0,
    last_sha256            text,
    last_source_modified_at timestamptz,

    -- consecutive_failures and last_error are surfaced in the dashboard so a
    -- project failing night after night is visible instead of silently absent
    -- from the list.
    consecutive_failures   integer NOT NULL DEFAULT 0,
    last_error             text,

    updated_at             timestamptz NOT NULL DEFAULT now()
);
