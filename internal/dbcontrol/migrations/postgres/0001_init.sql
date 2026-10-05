-- 0001_init.sql — control plane schema for Moogo.dev.
--
-- The control plane only holds Moogo's internal state: accounts, projects,
-- bucket catalog, and audit records. User data never lands in these tables;
-- user data lives in per-project SQLite files on disk.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Moogo accounts. One email equals one user.
--
-- Email always comes from Google, which guarantees it is verified, so there is
-- no separate identity table and no email verification flow. That constraint is
-- what lets email be the login key directly.
CREATE TABLE users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email               text        NOT NULL,
    name                text        NOT NULL DEFAULT '',
    avatar_url          text        NOT NULL DEFAULT '',

    -- Per-user quota. Defaults come from config at signup time. These columns
    -- exist up front so adding billing later does not require a destructive
    -- migration.
    quota_max_projects      integer NOT NULL DEFAULT 5,
    quota_max_db_bytes      bigint  NOT NULL DEFAULT 104857600,   -- 100 MB
    quota_max_storage_bytes bigint  NOT NULL DEFAULT 268435456,   -- 256 MB

    -- Billing placeholders. Everything is 'free' with no charge during
    -- phase 1; no billing code ships until later.
    billing_plan          text NOT NULL DEFAULT 'free',
    billing_customer_id   text,
    billing_status        text NOT NULL DEFAULT 'none',

    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT users_email_lower_chk CHECK (email = lower(email)),
    CONSTRAINT users_quota_projects_chk CHECK (quota_max_projects > 0),
    CONSTRAINT users_quota_db_bytes_chk CHECK (quota_max_db_bytes > 0),
    CONSTRAINT users_quota_storage_chk CHECK (quota_max_storage_bytes > 0)
);

-- Email is the login identity, so it has to be unique.
CREATE UNIQUE INDEX users_email_key ON users (email);

-- Projects.
--
-- The status column drives the creation saga:
--   'pending'  — Postgres is the source of truth, disk materialization not
--                yet confirmed
--   'ready'    — the SQLite file exists on disk
--   'failed'   — materialization failed, safe to retry or remove
--   'deleting' — removal in progress
--
-- The SQLite path is derived from the id: /data/dbs/{id}.db. Deriving it means
-- a project can never point at another project's file.
CREATE TABLE projects (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        text NOT NULL,

    status      text NOT NULL DEFAULT 'pending',

    -- The secret key is displayed once at creation and never again. Because
    -- the raw value never needs to be read back, a hash is sufficient; no
    -- encryption key exists to lose.
    secret_key_hash        text NOT NULL,
    secret_key_prefix      text NOT NULL,
    secret_key_rotated_at  timestamptz,

    -- Last materialization error, shown in the dashboard so a failed project
    -- is explainable rather than just absent.
    status_detail text,

    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    -- Soft delete. Rows are kept so the SQLite file removal stays auditable.
    deleted_at    timestamptz,

    CONSTRAINT projects_status_chk
        CHECK (status IN ('pending', 'ready', 'failed', 'deleting')),
    CONSTRAINT projects_name_len_chk CHECK (char_length(name) BETWEEN 1 AND 64)
);

CREATE INDEX projects_user_id_idx ON projects (user_id) WHERE deleted_at IS NULL;

-- Surfaces projects that need reconciler attention without scanning everything.
CREATE INDEX projects_needs_reconcile_idx ON projects (status)
    WHERE status <> 'ready' AND deleted_at IS NULL;

-- Buckets inside a project.
--
-- The 256 MB storage quota is counted per project, not per bucket, so this
-- table is only a name catalog. Object bytes live in bucket_objects.
CREATE TABLE buckets (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),

    -- Lowercase slug: bucket names appear in URLs, so the charset is
    -- deliberately narrow.
    CONSTRAINT buckets_name_chk CHECK (name ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
    CONSTRAINT buckets_name_key UNIQUE (project_id, name)
);

-- Request audit trail, backing real-time monitoring in the dashboard.
--
-- Rows are pruned on a retention schedule. Without pruning this table becomes
-- the reason the disk fills up.
CREATE TABLE activity_logs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   uuid REFERENCES projects (id) ON DELETE CASCADE,
    user_id      uuid REFERENCES users (id) ON DELETE SET NULL,
    method       text NOT NULL,
    path         text NOT NULL,
    status       integer NOT NULL,
    duration_ms  integer NOT NULL DEFAULT 0,
    source       text NOT NULL DEFAULT 'api',
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Primary listing order: newest first, scoped to one project.
CREATE INDEX activity_logs_project_created_idx
    ON activity_logs (project_id, created_at DESC);

-- Retention pruning scans by time across all projects.
CREATE INDEX activity_logs_created_idx ON activity_logs (created_at DESC);

-- Keeps updated_at accurate without every UPDATE having to set it by hand.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER projects_set_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();