-- 0005_project_paused_status.sql — allow a project to be paused.
--
-- projects_status_chk was written when the lifecycle was pending -> ready ->
-- failed -> deleting, and it enumerates those four values exactly. Adding
-- ProjectPaused to the Go enum was therefore not enough: the database rejected
-- every pause with
--
--   new row for relation "projects" violates check constraint "projects_status_chk"
--
-- which surfaced as a 500 from POST /pause while the project stayed ready. So
-- pausing never actually stopped anything, and the handler-level tests missed it
-- because they run against an in-memory fake with no constraint.
--
-- The constraint is dropped and recreated rather than altered because there is no
-- ALTER CONSTRAINT form that replaces an expression.

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_chk;

ALTER TABLE projects
    ADD CONSTRAINT projects_status_chk
    CHECK (status IN ('pending', 'ready', 'failed', 'deleting', 'paused'));

-- paused_at records when the owner paused the project, so "paused since 3 days"
-- is answerable without reading the activity log.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS paused_at timestamptz;
