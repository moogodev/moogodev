-- 0003_password_auth.sql — email/password sign-in alongside Google OAuth.
--
-- Google remains the primary identity. This migration adds the pieces an
-- email/password account needs: a hash on the user row and a table of pending
-- reset tokens. Both are additive, so existing Google-only users are untouched.

-- A user may sign in with a password. The column is nullable because a
-- Google-only account has no password; the value is a bcrypt hash, never the
-- plaintext.
ALTER TABLE users
    ADD COLUMN password_hash text;

-- Pending password-reset requests.
--
-- The token is shown to the user once, inside the email link. Only its SHA-256
-- is stored, so a database leak does not hand out working reset links. A token
-- is single-use (used_at) and short-lived (expires_at); either condition
-- rejects the reset.
CREATE TABLE password_reset_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  text NOT NULL,

    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT prt_used_chk CHECK (used_at IS NULL OR used_at >= created_at)
);

-- A reset is looked up by its hash; it is unique while pending.
CREATE UNIQUE INDEX prt_token_hash_key ON password_reset_tokens (token_hash);

-- Expiry scans and the per-user "cancel previous links" path both filter by
-- user, so this index covers both.
CREATE INDEX prt_user_id_idx ON password_reset_tokens (user_id);
