-- 0018_backup_download_tokens.sql — single-use download links for backups.
--
-- A "backup finished" email carries a link that must work without a session:
-- the whole point is that the owner can grab their database from their inbox.
-- A stateless signed token would stay valid for its whole window and could be
-- replayed by anyone who ever saw the mail or the URL. This table makes the
-- link single-use instead: the token is looked up by its hash, and consuming
-- it stamps used_at so a second click fails. That bounds a leaked link to one
-- download rather than to a window.
--
-- The raw token travels only in the email; the hash is what is stored, exactly
-- as with password resets and address confirmations, so a database leak does
-- not hand out working links.

CREATE TABLE backup_download_tokens (
    -- token_hash is the SHA-256 of the raw token, hex-encoded. It is the
    -- primary key because there is exactly one live row per issued link.
    token_hash text PRIMARY KEY,

    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- backup_id names the snapshot the link downloads. It carries no foreign
    -- key on purpose: a token is a record of an issued link, and deleting the
    -- backup it pointed at must not resurrect the row or cascade the project.
    -- The download simply fails with "not found" if the object is gone.
    backup_id  uuid NOT NULL,

    -- expires_at bounds the link window. A link is valid only until this is
    -- reached, and is consumed on first use regardless.
    expires_at timestamptz NOT NULL,

    -- used_at is set the moment a download consumes the link, and NULL while
    -- it is still live.
    used_at    timestamptz,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- Sweeping expired and used rows is the table's cleanup path, so it gets an
-- index on the two columns that decide it.
CREATE INDEX bdt_expires_idx ON backup_download_tokens (expires_at);

-- Deleting a project removes its issued links by cascade; this index makes
-- that cascade cheap and keeps the sweep scoped per project if it ever is.
CREATE INDEX bdt_project_idx ON backup_download_tokens (project_id);
