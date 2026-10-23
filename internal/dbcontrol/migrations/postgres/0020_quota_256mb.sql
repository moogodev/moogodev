-- 0020_quota_256mb.sql — one quota number for everything: 256 MiB.
--
-- 0001, 0009, and 0014 each carried their own number, which left the product
-- saying 250 MB in the UI while DECISIONS.md and a few defaults still said
-- 256 MB. The database, the object storage, and a bucket's own quota are all
-- 256 MiB now, and the code constant (config.StorageCeilingBytes) carries the
-- same value.
--
-- The earlier migrations are left untouched: the runner refuses to re-run a
-- file whose contents changed after it applied, so moving them is a new
-- migration rather than an edit to history.

-- --- Account quota ---
--
-- A column default only moves the next row written, so both the default and
-- the rows already signed up have to follow.
ALTER TABLE users
    ALTER COLUMN quota_max_db_bytes SET DEFAULT 268435456,      -- 256 MiB
    ALTER COLUMN quota_max_storage_bytes SET DEFAULT 268435456; -- 256 MiB

-- Only the free plan is re-priced. A paid plan's quota is a decision someone
-- made for that account, and a migration that overwrote every row would undo
-- it. Every account is on 'free' today.
UPDATE users
   SET quota_max_db_bytes      = 268435456,
       quota_max_storage_bytes = 268435456
 WHERE billing_plan = 'free';

-- --- Per-bucket default ---
--
-- A bucket may not promise more room than its project has. The free project
-- ceiling is 268435456 now, so the bucket default can sit at the same number
-- instead of the 247463936 that 0014 chose to stay under the old ceiling.
ALTER TABLE buckets
    ALTER COLUMN quota_bytes SET DEFAULT 268435456;

-- Existing buckets still on one of the old defaults move with it. A quota the
-- user set themselves is left alone: 262144000 and 247463936 are the only
-- values the old defaults wrote, and anything else is a deliberate choice.
UPDATE buckets
   SET quota_bytes = 268435456
 WHERE quota_bytes IN (247463936, 262144000);
