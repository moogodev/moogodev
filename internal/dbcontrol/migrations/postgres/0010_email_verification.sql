-- 0010_email_verification.sql — prove an email address belongs to the person who
-- signed up.
--
-- Password accounts previously went live the moment they were created, which
-- meant anyone could register somebody else's address and lock them out of the
-- account they never had. Google accounts were never affected, because the
-- provider returns a verified address.
--
-- Adding this separates the two cases on purpose: the column records whether an
-- address has been proven, and it is NULL for accounts that have not been
-- proven yet. Login checks it for password sign-in and ignores it for Google.

-- When the address was proven. NULL means "not verified yet".
--
-- The column is deliberately nullable with no default, and there is no NOT NULL
-- constraint. Both of those were tempting and both are wrong: a DEFAULT now()
-- would mark every future account as verified, and a NOT NULL check would make
-- "unverified" unrepresentable, which is exactly the state a new registration
-- needs to be created in.
--
-- Each insert path therefore states its own answer. CreateUserWithPassword
-- passes NULL, because a typed address has been proven by nothing. The Google
-- upsert passes now(), because the provider returned a verified address.
ALTER TABLE users
    ADD COLUMN email_verified_at timestamptz;

-- Every account that already exists is treated as verified.
--
-- These accounts signed in before this column existed, and several of them
-- signed in through Google, which proved the address at the time. Re-requiring
-- verification would lock out real users over a rule that did not apply when
-- they registered. Only accounts created from now on start unverified.
UPDATE users
    SET email_verified_at = now()
    WHERE email_verified_at IS NULL;

-- Pending address confirmations.
--
-- Shaped exactly like password_reset_tokens: the raw token goes into the email
-- and is never stored, only its SHA-256. Single-use via used_at, time-limited
-- via expires_at, and requesting a new link voids the previous one so only the
-- most recent is live.
--
-- The two tables are separate rather than one shared token table because the
-- actions they authorise are different: consuming a verification token changes
-- a flag on the account, while consuming a reset token replaces a credential.
-- Sharing one table would mean a reset token could be presented to the
-- verification endpoint.
CREATE TABLE email_verification_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  text NOT NULL,

    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT evt_used_chk CHECK (used_at IS NULL OR used_at >= created_at)
);

-- A confirmation is looked up by its hash, which is unique while pending.
CREATE UNIQUE INDEX evt_token_hash_key ON email_verification_tokens (token_hash);

-- Re-sending voids the earlier links for a user, and expiry sweeps filter by
-- user, so this index covers both.
CREATE INDEX evt_user_id_idx ON email_verification_tokens (user_id);