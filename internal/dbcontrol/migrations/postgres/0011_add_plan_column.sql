-- 0011_add_plan_column.sql — the billing plan column lands in the users table
-- so every account carries a plan from creation instead of picking one up
-- later. Phase 1 has no billing: every account is on the free plan, and the
-- column name plus a default are what make that true.
--
-- The column is NOT NULL with a default, and there is no migration to run
-- afterwards to fill the eleven accounts that already existed before this
-- column was a thing. They are all free.

ALTER TABLE users
    ADD COLUMN billing_plan text NOT NULL DEFAULT 'free';

-- The check the server applies whenever a quota may change, restated here so a
-- reader of the schema cannot mistake this column for a switch the app can
-- throw under load.
CREATE INDEX IF NOT EXISTS users_billing_plan_idx
    ON users (billing_plan);
