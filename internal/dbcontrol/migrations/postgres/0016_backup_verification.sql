-- 0016_backup_verification.sql — restore-drill results for backups.
--
-- A backup that has never been restored is a hope, not a guarantee: the upload
-- can be truncated, the object can rot in storage, or the file can be corrupt in
-- a way the size and checksum recorded at upload time cannot see, because those
-- were computed on the same bytes. A periodic drill downloads the newest backup,
-- checks it against its recorded checksum, and opens it read-only to run SQLite's
-- own integrity check. This migration stores the result so the dashboard can say
-- whether the newest backup was actually proven restorable, and when.
--
-- The columns live on the state row rather than the history because the answer
-- belongs to the project's current backup, not to one historical object: the
-- scheduler asks "has this project been verified recently?" on its own clock.

ALTER TABLE database_backup_state
    -- last_verified_at is when the newest backup was last downloaded and
    -- integrity-checked, whether or not that check passed.
    ADD COLUMN last_verified_at   timestamptz,
    -- last_verify_error is the reason the last drill failed, and NULL when it
    -- passed. It is kept beside last_error rather than replacing it: a backup
    -- can upload cleanly and still fail to verify, and an operator needs to
    -- tell those two failures apart.
    ADD COLUMN last_verify_error  text;
