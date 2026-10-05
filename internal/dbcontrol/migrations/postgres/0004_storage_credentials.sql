-- 0004_storage_credentials.sql — credentials for object storage.
--
-- Object storage used to be authorized by the project's SQL secret key. That
-- conflated two different risks: a credential meant to run SELECT could also
-- read and overwrite every file, and rotating the SQL key silently revoked
-- storage access for every running application.
--
-- A credential here is a standalone key pair, modelled on the way Cloudflare
-- R2 issues API tokens: an access key id that travels in a header on every
-- request, and a secret shown exactly once. Revoking or rotating one leaves
-- the project's SQL key and its other credentials untouched.
--
-- Credentials are per project rather than per bucket. The object API is
-- addressed by project (/p/{project_id}/bucket/...), and bucket_objects is
-- unique on (project_id, key), so a bucket-scoped credential would have no
-- place to point. Scoping follows the URL.

CREATE TABLE storage_credentials (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,

    -- Public identifier, sent on every request. It is not a secret: it is
    -- carried in a header and is safe to log. What makes it unique is the
    -- random suffix.
    access_key_id text NOT NULL,

    -- SHA-256 of the secret. The plaintext existed only in the response that
    -- created or rotated this row.
    secret_key_hash text NOT NULL,

    -- A short prefix so the owner can tell two credentials apart in a list.
    secret_key_preview text NOT NULL DEFAULT '',

    -- Free-form label, e.g. "production web app". Purely for the owner.
    label text NOT NULL DEFAULT '',

    created_at   timestamptz NOT NULL DEFAULT now(),
    rotated_at   timestamptz,
    -- Set when the credential is revoked. The row is kept so the audit trail
    -- still shows that the credential existed and when it died.
    revoked_at   timestamptz,

    -- Access key ids are looked up on every storage request, so this has to be
    -- an index rather than a table scan.
    CONSTRAINT storage_credentials_access_key_key UNIQUE (access_key_id)
);

-- Listing a project's credentials in the dashboard.
CREATE INDEX storage_credentials_project_created_idx
    ON storage_credentials (project_id, created_at DESC);
