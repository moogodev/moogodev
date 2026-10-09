-- 0013_session_epoch.sql — a per-account session revocation counter.
--
-- The session cookie is a signed token with no server-side record, so logging
-- out used to leave the token itself valid until it expired: any copy of the
-- cookie kept working. The epoch fixes that without a session table. Every
-- token carries the epoch it was issued under, every control-plane request
-- compares that against the row, and bumping the number on logout retires
-- every token the account has outstanding -- all devices, not only the one
-- that clicked sign out, which is the safer direction to fail.
--
-- Existing tokens have no epoch claim and read as 0, and the column default is
-- 0, so a deployed session survives the migration and dies at its natural
-- expiry rather than at the next deploy.

ALTER TABLE users
    ADD COLUMN session_epoch bigint NOT NULL DEFAULT 0;
