-- 0002_bucket_objects.sql — object catalog inside buckets.
--
-- Object payloads live on disk at /data/buckets/{project_id}/{key}. Postgres
-- stores only the metadata, which is what makes quota accounting possible
-- without touching the filesystem and lets listing skip a disk walk.

CREATE TABLE bucket_objects (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    bucket_id    uuid NOT NULL REFERENCES buckets (id) ON DELETE CASCADE,

    -- Object key is a path relative to the bucket root. The check constraint
    -- blocks absolute paths and parent traversal at the storage layer, so a
    -- bug upstream still cannot escape the project root.
    key          text NOT NULL,
    size_bytes   bigint NOT NULL DEFAULT 0,
    content_type text NOT NULL DEFAULT 'application/octet-stream',

    -- Set when the object is published to a public URL. NULL means private.
    public_token text,

    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT bucket_objects_size_chk CHECK (size_bytes >= 0),
    CONSTRAINT bucket_objects_key_chk CHECK (key !~ '(^/|\.\.)')
);

-- Object keys are unique per project rather than per bucket. That makes DELETE
-- work without knowing which bucket currently holds the file, and it matches
-- how the quota is counted.
CREATE UNIQUE INDEX bucket_objects_project_key_key
    ON bucket_objects (project_id, key);

-- Listing order within a bucket, newest first.
CREATE INDEX bucket_objects_bucket_created_idx
    ON bucket_objects (bucket_id, created_at DESC);

-- Partial index: resolves a public URL token without a sequential scan, and
-- only pays storage cost for published objects.
CREATE UNIQUE INDEX bucket_objects_public_token_key
    ON bucket_objects (public_token)
    WHERE public_token IS NOT NULL;

CREATE TRIGGER bucket_objects_set_updated_at
    BEFORE UPDATE ON bucket_objects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();