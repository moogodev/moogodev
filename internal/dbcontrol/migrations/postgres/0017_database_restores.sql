-- 0017_database_restores.sql — durable state for asynchronous restores.
--
-- A restore downloads a whole backup, takes a pre-restore snapshot and swaps
-- the live file. That is far too long to hold an HTTP request open for: a
-- client that gives up would leave the request context cancelled and the
-- restore half-done with no record of it. The request is therefore answered
-- with an id and the work runs in the background, and this table is where its
-- status lives so the dashboard can poll it and an operator can see what
-- happened after a crash.
--
-- A pending or running row is also the resume point: a process that restarts
-- mid-restore finds its own unfinished work here and picks it up, rather than
-- leaving a project stuck with no explanation.

CREATE TABLE database_restores (
    id           uuid PRIMARY KEY,

    project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- backup_id names the snapshot that was restored. It deliberately carries
    -- no foreign key: a restore is a record of an action taken, and deleting
    -- the backup it used must not erase the record that the project was rolled
    -- back on that day.
    backup_id    uuid NOT NULL,

    -- status is pending until a worker claims the row, then running, then
    -- either succeeded or failed. It is a text column with a check rather than
    -- an enum so a new terminal state is a code change, not a migration.
    status       text NOT NULL,

    -- error is why a failed restore stopped, and NULL otherwise.
    error        text,

    requested_at timestamptz NOT NULL DEFAULT now(),
    started_at   timestamptz,
    finished_at  timestamptz,

    CONSTRAINT database_restores_status_check
        CHECK (status IN ('pending', 'running', 'succeeded', 'failed'))
);

-- The dashboard reads one project's restores newest first.
CREATE INDEX database_restores_project_requested_idx
    ON database_restores (project_id, requested_at DESC);

-- At most one restore may be in flight for a project. Two concurrent restores
-- of one project would each take a pre-restore snapshot and each swap the live
-- file, and the loser's pre-restore snapshot would describe a state that no
-- longer exists. A partial unique index enforces the rule in the database, so
-- it holds across instances and not only within one process.
CREATE UNIQUE INDEX database_restores_one_active_idx
    ON database_restores (project_id)
    WHERE status IN ('pending', 'running');
